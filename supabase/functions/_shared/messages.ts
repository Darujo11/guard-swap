// Textos das mensagens de WhatsApp do Escala Smart. Mudou um texto? É aqui.
// Usado por notify-swap-event, notify-swap-reminder, notify-tre-leave, notify-tre-leave-guard e
// forgot-password. Funções puras (sem rede/banco) para poder testar: messages.test.ts.
//
// Regras de redação (revisadas com a coordenação em 2026-10-23):
//   * saudação + nome, o que aconteceu, o que muda na escala de quem recebe, próximo passo, protocolo;
//   * datas sempre com dia da semana e dizendo quem trabalha em cada dia;
//   * sem artigo antes de nomes nem "meu amigo"/"o segurança" (servem para qualquer gênero);
//   * sem rodapé de "mensagem automática".

const APP_URL = 'https://escalasmart.com.br';

export const LINKS = {
  home: APP_URL,
  guardDashboard: `${APP_URL}/#/dashboard/guard`,
  adminSwaps: `${APP_URL}/#/admin/trocas`,
  adminDashboard: `${APP_URL}/#/dashboard/admin`,
};

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "Bom dia" / "Boa tarde" / "Boa noite" pelo horário de Brasília. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(now)
  );
  return hour >= 6 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
}

/** 'YYYY-MM-DD' (data sem hora, como no banco) -> "qui, 01/10". */
export function shortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** 'DD/MM/YYYY' (como o app manda nas folgas TRE) -> "qua, 05/11". Formato desconhecido volta igual. */
export function shortDateFromBR(brDate: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brDate.trim());
  return match ? shortDate(`${match[3]}-${match[2]}-${match[1]}`) : brDate;
}

/** Mesmo formato do comprovante impresso: "TRC-0920E7EB". */
export function swapProtocol(swapId: string): string {
  return `TRC-${swapId.slice(0, 8).toUpperCase()}`;
}

const hello = (name: string | null | undefined, now: Date, emoji = '') =>
  `${greeting(now)}${name ? `, ${name}` : ''}!${emoji ? ` ${emoji}` : ''}`;

const helloCalm = (name: string | null | undefined, now: Date) => `${greeting(now)}${name ? `, ${name}` : ''}.`;

// ------------------------------------------------------------------------------------------------
// Trocas de plantão
// ------------------------------------------------------------------------------------------------

export interface SwapMessageData {
  swapId: string;
  requester: string;
  target: string;
  /** Plantão original do solicitante, que o colega cobre ('YYYY-MM-DD'). */
  requesterDate: string;
  /** Plantão original do colega, que o solicitante cobre ('YYYY-MM-DD'). */
  targetDate: string;
  reason?: string | null;
  /** Nome do coordenador da organização (quem recebe o pedido de aprovação). */
  coordinator?: string | null;
  /** Nome de quem aprovou/rejeitou. */
  decidedBy?: string | null;
  /** Código de verificação da assinatura eletrônica (swap_signatures). */
  verificationCode?: string | null;
}

/** Linhas "• dia – quem trabalha", em ordem de data. */
function bullets(lines: { date: string; text: string }[]): string {
  return [...lines]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => `• *${shortDate(l.date)}* – ${l.text}`)
    .join('\n');
}

const protocolLine = (d: SwapMessageData) =>
  `Protocolo ${swapProtocol(d.swapId)}${d.verificationCode ? ` · Verificação ${d.verificationCode}` : ''}`;

const decidedByText = (d: SwapMessageData) => (d.decidedBy ? `por ${d.decidedBy}` : 'pela coordenação');

export const swapMessages = {
  /** 1. Troca solicitada -> colega */
  requestedToTarget(d: SwapMessageData, now = new Date()): string {
    return [
      hello(d.target, now),
      `${d.requester} pediu para trocar de plantão com você:`,
      '',
      bullets([
        { date: d.requesterDate, text: `você cobre o plantão de ${d.requester}` },
        { date: d.targetDate, text: `${d.requester} cobre o seu plantão` },
      ]),
      ...(d.reason?.trim() ? ['', `Motivo: ${d.reason.trim()}`] : []),
      '',
      `Para aceitar ou recusar: ${LINKS.guardDashboard}`,
      protocolLine(d),
    ].join('\n');
  },

  /** 2. Troca solicitada -> solicitante */
  requestedToRequester(d: SwapMessageData, now = new Date()): string {
    return [
      hello(d.requester, now),
      `Seu pedido de troca com ${d.target} foi registrado:`,
      '',
      bullets([
        { date: d.requesterDate, text: `${d.target} cobre o seu plantão` },
        { date: d.targetDate, text: `você cobre o plantão de ${d.target}` },
      ]),
      '',
      `Próximos passos: ${d.target} precisa aceitar e, depois, a coordenação aprovar. Você recebe um aviso a cada etapa.`,
      '',
      protocolLine(d),
    ].join('\n');
  },

  /** 3. Colega aceitou -> coordenação */
  acceptedToCoordinator(d: SwapMessageData, now = new Date()): string {
    return [
      hello(d.coordinator, now),
      'Uma troca está aguardando sua aprovação:',
      '',
      bullets([
        { date: d.requesterDate, text: `${d.target} cobre o plantão de ${d.requester}` },
        { date: d.targetDate, text: `${d.requester} cobre o plantão de ${d.target}` },
      ]),
      '',
      `Os dois já assinaram. Para aprovar ou rejeitar: ${LINKS.adminSwaps}`,
      protocolLine(d),
    ].join('\n');
  },

  /** 4. Colega aceitou -> solicitante */
  acceptedToRequester(d: SwapMessageData, now = new Date()): string {
    return [
      hello(d.requester, now),
      `${d.target} aceitou a troca. Agora falta a aprovação da coordenação – você recebe um aviso assim que ela sair.`,
      '',
      protocolLine(d),
    ].join('\n');
  },

  /** 5. Aprovada -> solicitante */
  approvedToRequester(d: SwapMessageData, now = new Date()): string {
    return [
      hello(d.requester, now, '✅'),
      `Sua troca com ${d.target} foi *aprovada* ${decidedByText(d)}. Sua escala fica assim:`,
      '',
      bullets([
        { date: d.requesterDate, text: `você fica de folga (${d.target} cobre)` },
        { date: d.targetDate, text: `você trabalha, no lugar de ${d.target}` },
      ]),
      '',
      protocolLine(d),
    ].join('\n');
  },

  /** 6. Aprovada -> colega */
  approvedToTarget(d: SwapMessageData, now = new Date()): string {
    return [
      hello(d.target, now, '✅'),
      `Sua troca com ${d.requester} foi *aprovada* ${decidedByText(d)}. Sua escala fica assim:`,
      '',
      bullets([
        { date: d.requesterDate, text: `você trabalha, no lugar de ${d.requester}` },
        { date: d.targetDate, text: `você fica de folga (${d.requester} cobre)` },
      ]),
      '',
      protocolLine(d),
    ].join('\n');
  },

  /** 7. Rejeitada pela coordenação -> solicitante */
  rejectedByCoordinatorToRequester(d: SwapMessageData, now = new Date()): string {
    const who = d.decidedBy ? ` (${d.decidedBy})` : '';
    return [
      helloCalm(d.requester, now),
      `Sua troca com ${d.target} *não foi aprovada* pela coordenação${who}. Sua escala continua como estava: *${shortDate(d.requesterDate)}* segue sendo o seu plantão.`,
      '',
      'Em caso de dúvida, fale com a coordenação.',
      protocolLine(d),
    ].join('\n');
  },

  /** 8. Rejeitada pela coordenação -> colega */
  rejectedByCoordinatorToTarget(d: SwapMessageData, now = new Date()): string {
    const who = d.decidedBy ? ` (${d.decidedBy})` : '';
    return [
      helloCalm(d.target, now),
      `A troca com ${d.requester} *não foi aprovada* pela coordenação${who}. Sua escala continua como estava: *${shortDate(d.targetDate)}* segue sendo o seu plantão.`,
      '',
      protocolLine(d),
    ].join('\n');
  },

  /** 9. Colega recusou -> solicitante */
  rejectedByTargetToRequester(d: SwapMessageData, now = new Date()): string {
    return [
      helloCalm(d.requester, now),
      `${d.target} recusou a troca. Sua escala continua como estava: *${shortDate(d.requesterDate)}* segue sendo o seu plantão.`,
      '',
      `Se quiser, peça a troca para outra pessoa: ${LINKS.guardDashboard}`,
      protocolLine(d),
    ].join('\n');
  },

  /** 10. Cancelada pelo solicitante -> colega */
  cancelledToTarget(d: SwapMessageData, now = new Date()): string {
    return [
      helloCalm(d.target, now),
      `${d.requester} cancelou o pedido de troca. Nada muda na sua escala: *${shortDate(d.targetDate)}* segue sendo o seu plantão.`,
      '',
      protocolLine(d),
    ].join('\n');
  },
};

// ------------------------------------------------------------------------------------------------
// Lembrete diário (8h) de quem cobre um plantão amanhã
// ------------------------------------------------------------------------------------------------

export interface ReminderData {
  swapId: string;
  /** Quem vai cobrir amanhã (recebe a mensagem). */
  name: string;
  /** Dono original do plantão de amanhã. */
  otherName: string;
  /** Plantão de amanhã ('YYYY-MM-DD'). */
  shiftDate: string;
  /** Plantão que o outro cobre em troca ('YYYY-MM-DD'). */
  otherShiftDate: string;
}

export function swapReminder(d: ReminderData, now = new Date()): string {
  return [
    hello(d.name, now, '🔔'),
    `Lembrete: *amanhã (${shortDate(d.shiftDate)})*, você cobre o plantão de ${d.otherName}, pela troca aprovada.`,
    `Em troca, ${d.otherName} cobre o seu plantão de *${shortDate(d.otherShiftDate)}*.`,
    '',
    `Protocolo ${swapProtocol(d.swapId)}`,
  ].join('\n');
}

// ------------------------------------------------------------------------------------------------
// Folga TRE
// ------------------------------------------------------------------------------------------------

export function treRequestToCoordinator(
  d: { coordinator: string | null; guard: string; leaveDate: string; remainingDays?: number | string | null },
  now = new Date()
): string {
  const remaining = Number(d.remainingDays);
  const remainingText = Number.isFinite(remaining)
    ? remaining === 1
      ? ' Ainda resta 1 folga TRE a tirar.'
      : ` Ainda restam ${remaining} folgas TRE a tirar.`
    : '';
  return [
    hello(d.coordinator, now),
    `${d.guard} pediu folga TRE para *${shortDateFromBR(d.leaveDate)}*.${remainingText}`,
    '',
    `Para autorizar ou recusar: ${LINKS.adminDashboard}`,
  ].join('\n');
}

export function treDecisionToGuard(
  d: { guard: string; leaveDate: string; coordinator: string | null; approved: boolean },
  now = new Date()
): string {
  const by = d.coordinator ? `por ${d.coordinator}` : 'pela coordenação';
  return d.approved
    ? [hello(d.guard, now, '✅'), `Sua folga TRE de *${shortDateFromBR(d.leaveDate)}* foi *autorizada* ${by}.`].join('\n')
    : [
        helloCalm(d.guard, now),
        `Sua folga TRE de *${shortDateFromBR(d.leaveDate)}* *não foi autorizada* ${by}. Em caso de dúvida, fale com a coordenação.`,
      ].join('\n');
}

// ------------------------------------------------------------------------------------------------
// Esqueci a senha
// ------------------------------------------------------------------------------------------------

export function passwordReset(d: { name: string; password: string }, now = new Date()): string {
  return [
    hello(d.name, now),
    'Recebemos um pedido de nova senha para o Escala Smart.',
    '',
    `Sua senha provisória: *${d.password}*`,
    '',
    `Entre em ${LINKS.home} e troque a senha em *Meu perfil*.`,
    'Se não foi você que pediu, avise a coordenação.',
  ].join('\n');
}
