import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { escapeHtml, PRINT_DOCUMENT_CSP_META } from '@/lib/html';
import { SWAP_STATUS_CONFIG } from '@/lib/constants';
import { formatSwapProtocol } from '@/utils/effectiveSchedule';
import type { SwapRequest } from '@/lib/types';
import {
  SWAP_SIGNATURE_ACTION_LABELS,
  SWAP_SIGNER_ROLE_LABELS,
  type SwapSignatureAction,
  type SwapSignerRole,
} from '@/lib/swapSignatureText';

/**
 * Comprovante de troca de plantão para impressão (A4), usado pelo coordenador (AdminSwaps) e pelo
 * segurança (GuardSwapList). Função pura: recebe os dados e devolve o HTML completo; quem abre a
 * janela e imprime é printSwapReceipt.ts. Todo valor vindo do banco passa por escapeHtml.
 */

/** Linha de swap_signatures usada no comprovante. */
export interface ReceiptSignature {
  action: string;
  signer_role: string;
  signer_name: string;
  signed_at: string;
  verification_code: string;
  ip: string | null;
}

export interface SwapReceiptOptions {
  /** Logo embutida como data: URL (a CSP do documento bloqueia qualquer imagem de fora). */
  logoDataUrl?: string | null;
  generatedAt?: Date;
  /** Assinaturas eletrônicas da troca; sem elas o comprovante sai com linhas para assinar à mão. */
  signatures?: ReceiptSignature[];
  /** Endereço da página de verificação, terminando antes do código (ex.: "https://escalasmart.com.br/#/verificar/"). */
  verifyBaseUrl?: string;
}

type Tone = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

const STATUS_TONE: Record<string, Tone> = {
  APPROVED: 'success',
  PENDING: 'warning',
  ACCEPTED: 'info',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

// 'YYYY-MM-DD' é data sem hora: new Date('2026-10-01') cairia em 30/09 no fuso do Brasil.
const parseDateOnly = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const fmtDate = (value: string) => format(parseDateOnly(value), 'dd/MM/yyyy');
const fmtWeekday = (value: string) => format(parseDateOnly(value), 'EEEE', { locale: ptBR });
const fmtDay = (value: string) => format(parseDateOnly(value), 'dd');
const fmtMonthYear = (value: string) => {
  const text = format(parseDateOnly(value), "MMMM 'de' yyyy", { locale: ptBR });
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const fmtDateTime = (value: string | Date) =>
  format(typeof value === 'string' ? new Date(value) : value, "dd/MM/yyyy 'às' HH:mm");
const fmtDateTimeSeconds = (value: string) => format(new Date(value), "dd/MM/yyyy 'às' HH:mm:ss");

/** "22997604822" / "5522997604822" -> "(22) 99760-4822"; formatos desconhecidos voltam como vieram. */
export function formatPhoneBR(raw?: string | null): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('55')) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
}

const personLine = (name?: string, team?: string) =>
  `<span class="who">${escapeHtml(name || '—')}</span>${team ? `<span class="team">${escapeHtml(team)}</span>` : ''}`;

interface Step {
  title: string;
  detail: string;
  state: 'done' | 'current' | 'failed' | 'idle';
}

function buildSteps(request: SwapRequest): Step[] {
  const requester = request.requester?.name || 'Solicitante';
  const target = request.target?.name || 'colega';
  const decidedAt = request.admin_approved_at ? fmtDateTime(request.admin_approved_at) : null;
  const approver = request.admin_approver?.name || 'Coordenação';

  const steps: Step[] = [
    { title: 'Solicitada', detail: `${fmtDateTime(request.created_at)} · por ${requester}`, state: 'done' },
  ];

  // Recusa pelo colega: REJECTED sem decisão da coordenação.
  const rejectedByTarget = request.status === 'REJECTED' && !request.admin_approved_at && !request.target_confirmation;

  if (request.status === 'CANCELLED') {
    steps.push({ title: 'Cancelada', detail: 'Cancelada pelo solicitante antes da conclusão', state: 'failed' });
    return steps;
  }

  if (rejectedByTarget) {
    steps.push({ title: 'Recusada pelo colega', detail: `${target} não aceitou a troca`, state: 'failed' });
    return steps;
  }

  steps.push(
    request.target_confirmation
      ? { title: 'Aceita pelo colega', detail: `${target} confirmou ciência e concordância`, state: 'done' }
      : { title: 'Aguardando o colega', detail: `${target} ainda não respondeu`, state: 'current' }
  );

  if (request.status === 'APPROVED') {
    steps.push({ title: 'Aprovada pela coordenação', detail: `${decidedAt ?? ''} · por ${approver}`, state: 'done' });
  } else if (request.status === 'REJECTED') {
    steps.push({ title: 'Rejeitada pela coordenação', detail: `${decidedAt ?? ''} · por ${approver}`, state: 'failed' });
  } else {
    steps.push({
      title: 'Aguardando a coordenação',
      detail: 'A troca só vale depois da aprovação',
      state: request.target_confirmation ? 'current' : 'idle',
    });
  }

  return steps;
}

export function buildSwapReceiptHtml(request: SwapRequest, options: SwapReceiptOptions = {}): string {
  const generatedAt = options.generatedAt ?? new Date();
  const protocol = formatSwapProtocol(request.id);
  const tone = STATUS_TONE[request.status] ?? 'neutral';
  const statusLabel = SWAP_STATUS_CONFIG[request.status as keyof typeof SWAP_STATUS_CONFIG]?.label ?? request.status;

  const requester = request.requester;
  const target = request.target;
  const requesterTeam = requester?.team?.name;
  const targetTeam = target?.team?.name;

  // requester_shift_date: plantão do solicitante que o colega assume.
  // target_shift_date: plantão do colega que o solicitante assume.
  const rows = [
    { date: request.requester_shift_date, from: [requester?.name, requesterTeam], to: [target?.name, targetTeam] },
    { date: request.target_shift_date, from: [target?.name, targetTeam], to: [requester?.name, requesterTeam] },
  ].sort((a, b) => a.date.localeCompare(b.date));

  const coverageRows = rows
    .map(
      (r) => `
        <tr>
          <td class="date">
            <span class="day">${escapeHtml(fmtDay(r.date))}</span>
            <span class="date-meta">
              <span class="month">${escapeHtml(fmtMonthYear(r.date))}</span>
              <span class="weekday">${escapeHtml(fmtWeekday(r.date))}</span>
            </span>
          </td>
          <td>${personLine(r.from[0], r.from[1])}</td>
          <td class="arrow" aria-hidden="true">→</td>
          <td>${personLine(r.to[0], r.to[1])}</td>
        </tr>`
    )
    .join('');

  const person = (label: string, p: typeof requester, team?: string, extra = '') => `
    <div class="person">
      <div class="eyebrow">${label}</div>
      <div class="person-name">${escapeHtml(p?.name || '—')}</div>
      <dl>
        <div><dt>Equipe</dt><dd>${escapeHtml(team || '—')}</dd></div>
        <div><dt>WhatsApp</dt><dd>${escapeHtml(formatPhoneBR(p?.phone) || '—')}</dd></div>
        ${extra}
      </dl>
    </div>`;

  const steps = buildSteps(request)
    .map(
      (s) => `
        <li class="step ${s.state}">
          <span class="dot" aria-hidden="true"></span>
          <span class="step-title">${escapeHtml(s.title)}</span>
          <span class="step-detail">${escapeHtml(s.detail)}</span>
        </li>`
    )
    .join('');

  const signatures = options.signatures ?? [];
  const verificationCode = signatures[0]?.verification_code;
  const verifyUrl = verificationCode && options.verifyBaseUrl ? `${options.verifyBaseUrl}${verificationCode}` : null;

  const signaturesBlock = signatures.length
    ? `
  <section class="e-signatures">
    <h2>Assinaturas eletrônicas</h2>
    <table class="sigs">
      <colgroup><col style="width: 30mm"><col><col style="width: 22mm"><col style="width: 42mm"><col style="width: 30mm"></colgroup>
      <thead><tr><th>Papel</th><th>Nome</th><th>Ato</th><th>Data e hora</th><th>IP</th></tr></thead>
      <tbody>${signatures
        .map(
          (sig) => `
        <tr>
          <td class="muted">${escapeHtml(SWAP_SIGNER_ROLE_LABELS[sig.signer_role as SwapSignerRole] ?? sig.signer_role)}</td>
          <td class="strong">${escapeHtml(sig.signer_name)}</td>
          <td>${escapeHtml(SWAP_SIGNATURE_ACTION_LABELS[sig.action as SwapSignatureAction] ?? sig.action)}</td>
          <td class="mono">${escapeHtml(fmtDateTimeSeconds(sig.signed_at))}</td>
          <td class="mono muted">${escapeHtml(sig.ip || '—')}</td>
        </tr>`
        )
        .join('')}
      </tbody>
    </table>
    <div class="verify">
      <div class="verify-code">
        <span class="eyebrow">Código de verificação</span>
        <span class="code">${escapeHtml(verificationCode)}</span>
      </div>
      <p class="verify-text">
        Atos assinados eletronicamente no Escala Smart, com confirmação de senha de cada signatário.
        ${verifyUrl ? `Confira a autenticidade e se os termos não foram alterados em <strong>${escapeHtml(verifyUrl.replace(/^https?:\/\//, ''))}</strong>.` : ''}
      </p>
    </div>
  </section>`
    : `
  <div class="signatures">
    <div class="signature"><strong>${escapeHtml(requester?.name || 'Solicitante')}</strong><span>Solicitante</span></div>
    <div class="signature"><strong>${escapeHtml(target?.name || 'Colega')}</strong><span>Colega da troca</span></div>
    <div class="signature"><strong>${escapeHtml(request.admin_approver?.name || '')}</strong><span>Coordenação</span></div>
  </div>`;

  const logo = options.logoDataUrl
    ? `<img class="logo" src="${escapeHtml(options.logoDataUrl)}" alt="Câmara Municipal de Macaé">`
    : `<div class="logo-text">Câmara Municipal de Macaé</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${PRINT_DOCUMENT_CSP_META}
<meta charset="UTF-8">
<title>Troca de Plantão ${escapeHtml(protocol)}</title>
<style>
  @page { size: A4; margin: 0; }
  :root {
    --navy: #1b2b4b; --ink: #1f2937; --muted: #6b7280; --faint: #9ca3af;
    --line: #e5e7eb; --soft: #f6f7fa; --gold: #e8b923;
    --success: #17663a; --success-bg: #e9f6ee; --success-line: #b9e3c8;
    --warning: #8a5a00; --warning-bg: #fff6df; --warning-line: #f3dca0;
    --info: #1d4f91; --info-bg: #eaf2fd; --info-line: #bcd4f5;
    --danger: #a3221c; --danger-bg: #fdeceb; --danger-line: #f3c2bf;
    --neutral: #4b5563; --neutral-bg: #f1f2f4; --neutral-line: #d6d9de;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: var(--ink); font-size: 10.5pt; line-height: 1.45;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    font-variant-numeric: tabular-nums;
  }
  .sheet { width: 210mm; min-height: 297mm; padding: 0 16mm 12mm; margin: 0 auto; display: flex; flex-direction: column; }
  .topbar { height: 3mm; background: var(--navy); margin: 0 -16mm; border-bottom: 1mm solid var(--gold); }

  header { display: flex; align-items: center; justify-content: space-between; gap: 8mm; padding: 7mm 0 5mm; border-bottom: 1px solid var(--line); }
  .logo { height: 15mm; width: auto; display: block; }
  .logo-text { font-weight: 800; font-size: 15pt; color: var(--navy); letter-spacing: -0.01em; }
  .doc-id { text-align: right; }
  .doc-kind { font-size: 8pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
  .doc-title { font-size: 15pt; font-weight: 750; color: var(--navy); margin: 1mm 0 1.5mm; letter-spacing: -0.01em; }
  .doc-meta { display: flex; gap: 3mm; justify-content: flex-end; align-items: center; }
  .protocol { font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace; font-size: 9.5pt; font-weight: 600; color: var(--ink); }
  .pill { display: inline-block; padding: 0.6mm 2.6mm; border-radius: 99px; font-size: 8pt; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; border: 1px solid; }
  .pill.success { color: var(--success); background: var(--success-bg); border-color: var(--success-line); }
  .pill.warning { color: var(--warning); background: var(--warning-bg); border-color: var(--warning-line); }
  .pill.info { color: var(--info); background: var(--info-bg); border-color: var(--info-line); }
  .pill.danger { color: var(--danger); background: var(--danger-bg); border-color: var(--danger-line); }
  .pill.neutral { color: var(--neutral); background: var(--neutral-bg); border-color: var(--neutral-line); }

  section { margin-top: 5.5mm; break-inside: avoid; }
  h2 { font-size: 8pt; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--navy); margin: 0 0 2.5mm; display: flex; align-items: center; gap: 2.5mm; }
  h2::after { content: ""; flex: 1; height: 1px; background: var(--line); }

  table.coverage { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; border: 1px solid var(--line); border-radius: 2.5mm; overflow: hidden; }
  .coverage th { font-size: 7.5pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); text-align: left; padding: 2.2mm 4mm; background: var(--soft); border-bottom: 1px solid var(--line); }
  .coverage td { padding: 2.8mm 4mm; vertical-align: middle; }
  table, tr, .verify, .signatures, footer { break-inside: avoid; }
  .coverage tr + tr td { border-top: 1px solid var(--line); }
  .coverage td.date { white-space: nowrap; }
  .day { font-size: 20pt; font-weight: 750; color: var(--navy); line-height: 1; vertical-align: middle; }
  .date-meta { display: inline-flex; flex-direction: column; vertical-align: middle; margin-left: 2.5mm; line-height: 1.25; }
  .month { font-size: 9pt; font-weight: 600; }
  .weekday { font-size: 8.5pt; color: var(--muted); }
  .coverage td.arrow { color: var(--faint); font-size: 13pt; text-align: center; padding-left: 0; padding-right: 0; }
  .who { display: block; font-weight: 600; }
  .team { display: block; font-size: 8.5pt; color: var(--muted); }
  .hint { font-size: 8.5pt; color: var(--muted); margin: 2mm 0 0; }

  .people { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
  .person { border: 1px solid var(--line); border-radius: 2.5mm; padding: 3mm 4mm; }
  .eyebrow { font-size: 7.5pt; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  .person-name { font-size: 12pt; font-weight: 700; color: var(--navy); margin: 0.8mm 0 2mm; }
  dl { margin: 0; display: grid; gap: 1mm; }
  dl div { display: flex; justify-content: space-between; gap: 4mm; font-size: 9pt; }
  dt { color: var(--muted); }
  dd { margin: 0; font-weight: 500; text-align: right; }

  .reason { background: var(--soft); border-left: 1mm solid var(--navy); border-radius: 0 2mm 2mm 0; padding: 3mm 4mm; white-space: pre-wrap; overflow-wrap: anywhere; }

  ol.timeline { list-style: none; margin: 0; padding: 0; }
  .step { position: relative; padding: 0 0 3mm 7mm; display: grid; grid-template-columns: 52mm 1fr; gap: 3mm; }
  .step:last-child { padding-bottom: 0; }
  .step::before { content: ""; position: absolute; left: 1.6mm; top: 3.5mm; bottom: -0.5mm; width: 0.4mm; background: var(--line); }
  .step:last-child::before { display: none; }
  .dot { position: absolute; left: 0; top: 1.1mm; width: 3.6mm; height: 3.6mm; border-radius: 50%; border: 0.5mm solid var(--faint); background: #fff; }
  .step.done .dot { background: var(--success); border-color: var(--success); }
  .step.current .dot { border-color: var(--warning); background: var(--warning-bg); }
  .step.failed .dot { background: var(--danger); border-color: var(--danger); }
  .step-title { font-weight: 600; }
  .step.idle .step-title, .step.idle .step-detail { color: var(--faint); }
  .step-detail { color: var(--muted); font-size: 9.5pt; }

  .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; margin-top: auto; padding-top: 16mm; }
  .signature { border-top: 1px solid var(--ink); padding-top: 1.5mm; text-align: center; font-size: 8.5pt; }
  .signature strong { display: block; font-weight: 600; min-height: 1.45em; }
  .signature span { color: var(--muted); }

  .e-signatures { margin-top: auto; padding-top: 4mm; }
  table.sigs { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8.5pt; }
  .sigs th { font-size: 7pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); text-align: left; padding: 1.5mm 2mm; border-bottom: 1px solid var(--line); }
  .sigs td { padding: 2mm; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: anywhere; }
  .sigs .strong { font-weight: 600; }
  .sigs .muted { color: var(--muted); }
  .mono { font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace; font-size: 8pt; }
  .verify { display: flex; gap: 5mm; align-items: center; margin-top: 3.5mm; padding: 3mm 4mm; border: 1px dashed var(--navy); border-radius: 2.5mm; }
  .verify-code { display: flex; flex-direction: column; gap: 0.5mm; min-width: 42mm; }
  .verify-code .code { font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace; font-size: 13pt; font-weight: 700; color: var(--navy); letter-spacing: 0.04em; }
  .verify-text { margin: 0; font-size: 8.5pt; color: var(--muted); }
  .verify-text strong { color: var(--ink); font-weight: 600; }

  footer { margin-top: 5mm; padding-top: 3mm; display: flex; justify-content: space-between; gap: 6mm; font-size: 7.5pt; color: var(--faint); border-top: 1px solid var(--line); }
  footer .full-id { font-family: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace; }

  @media screen {
    body { background: #e9ebef; padding: 8mm 0; }
    .sheet { background: #fff; box-shadow: 0 2mm 8mm rgba(15, 23, 42, 0.12); }
  }
</style>
</head>
<body>
<main class="sheet">
  <div class="topbar"></div>

  <header>
    ${logo}
    <div class="doc-id">
      <div class="doc-kind">Comprovante</div>
      <div class="doc-title">Troca de Plantão</div>
      <div class="doc-meta">
        <span class="protocol">${escapeHtml(protocol)}</span>
        <span class="pill ${tone}">${escapeHtml(statusLabel)}</span>
      </div>
    </div>
  </header>

  <section>
    <h2>Plantões trocados</h2>
    <table class="coverage">
      <colgroup><col style="width: 50mm"><col><col style="width: 12mm"><col></colgroup>
      <thead><tr><th>Data</th><th>Escalado originalmente</th><th></th><th>Assume o plantão</th></tr></thead>
      <tbody>${coverageRows}</tbody>
    </table>
    ${request.status === 'APPROVED' ? '' : '<p class="hint">A escala só muda depois que a troca é aprovada pela coordenação.</p>'}
  </section>

  <section>
    <h2>Envolvidos</h2>
    <div class="people">
      ${person('Solicitante', requester, requesterTeam)}
      ${person('Colega da troca', target, targetTeam,
        `<div><dt>Ciência</dt><dd>${request.target_confirmation ? 'Confirmada' : 'Pendente'}</dd></div>`)}
    </div>
  </section>

  <section>
    <h2>Motivo</h2>
    <div class="reason">${escapeHtml(request.reason || '—')}</div>
  </section>

  <section>
    <h2>Andamento</h2>
    <ol class="timeline">${steps}</ol>
  </section>

  ${signaturesBlock}

  <footer>
    <span>Gerado em ${escapeHtml(fmtDateTime(generatedAt))} pelo Escala Smart</span>
    <span class="full-id">Protocolo completo: ${escapeHtml(request.id)}</span>
  </footer>
</main>
</body>
</html>`;
}
