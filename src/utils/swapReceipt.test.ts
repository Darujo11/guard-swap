import { describe, expect, it } from 'vitest';
import type { SwapRequest } from '@/lib/types';
import { buildSwapReceiptHtml, formatPhoneBR } from './swapReceipt';

/** Troca real usada como referência (Philipe x Fabio, outubro/2026). */
const base = {
  id: '0920e7eb-d78d-4b64-bf9d-42ecc9c1ad82',
  requester_id: 'r',
  target_id: 't',
  requester_shift_date: '2026-10-01',
  target_shift_date: '2026-10-20',
  reason: 'Troca',
  status: 'APPROVED',
  target_confirmation: true,
  admin_approved: true,
  admin_approved_at: '2026-09-30T13:58:00Z',
  created_at: '2026-09-29T12:16:00Z',
  updated_at: '2026-09-30T13:58:00Z',
  requester: { name: 'Philipe', phone: '22997604822', team: { name: 'Equipe B' } },
  target: { name: 'Fabio', phone: '22999491428', team: { name: 'Equipe A' } },
  admin_approver: { name: 'Coordenador Morais' },
} as unknown as SwapRequest;

const build = (overrides: Partial<Record<keyof SwapRequest, unknown>> = {}) =>
  buildSwapReceiptHtml({ ...base, ...overrides } as SwapRequest, { generatedAt: new Date(2026, 9, 23, 11, 46) });

const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('buildSwapReceiptHtml', () => {
  it('começa o <head> pela CSP, antes de qualquer conteúdo', () => {
    const html = build();
    expect(html.indexOf('Content-Security-Policy')).toBeGreaterThan(-1);
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<title>'));
  });

  it('escapa motivo e nomes: texto do usuário nunca vira tag', () => {
    const html = build({
      reason: '<img src=x onerror=alert(1)>',
      requester: { name: '<script>alert(2)</script>', phone: null, team: { name: 'Equipe B' } },
    });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
  });

  it('mostra quem assume cada plantão, em ordem de data', () => {
    const t = text(build());
    expect(t).toMatch(/01 Outubro de 2026 quinta-feira Philipe Equipe B → Fabio Equipe A/);
    expect(t).toMatch(/20 Outubro de 2026 terça-feira Fabio Equipe A → Philipe Equipe B/);
    expect(t.indexOf('01 Outubro')).toBeLessThan(t.indexOf('20 Outubro'));
  });

  it('ordena por data mesmo quando o plantão do colega vem antes', () => {
    const t = text(build({ requester_shift_date: '2026-10-20', target_shift_date: '2026-10-01' }));
    expect(t).toMatch(/01 Outubro de 2026 quinta-feira Fabio Equipe A → Philipe Equipe B/);
    expect(t.indexOf('01 Outubro')).toBeLessThan(t.indexOf('20 Outubro'));
  });

  it('usa o protocolo curto no topo e o completo no rodapé', () => {
    const t = text(build());
    expect(t).toContain('TRC-0920E7EB');
    expect(t).toContain('Protocolo completo: 0920e7eb-d78d-4b64-bf9d-42ecc9c1ad82');
  });

  it('aprovada: três etapas concluídas e quem aprovou', () => {
    const html = build();
    expect(html).toContain('pill success');
    expect(text(html)).toContain('Aprovada pela coordenação');
    expect(text(html)).toContain('por Coordenador Morais');
    expect(html.match(/class="step done"/g)).toHaveLength(3);
    expect(text(html)).not.toContain('A escala só muda');
  });

  it('pendente: aguardando colega e coordenação, com aviso de que a escala ainda não mudou', () => {
    const html = build({ status: 'PENDING', target_confirmation: false, admin_approved_at: null, admin_approver: null });
    expect(html).toContain('pill warning');
    expect(text(html)).toContain('Aguardando o colega');
    expect(text(html)).toContain('Aguardando a coordenação');
    expect(text(html)).toContain('A escala só muda depois que a troca é aprovada');
  });

  it('recusada pelo colega: não mostra etapa da coordenação', () => {
    const t = text(build({ status: 'REJECTED', target_confirmation: false, admin_approved_at: null, admin_approver: null }));
    expect(t).toContain('Recusada pelo colega');
    expect(t).not.toContain('coordenação ·');
    expect(t).not.toContain('Aguardando a coordenação');
  });

  it('rejeitada pela coordenação depois do aceite', () => {
    const html = build({ status: 'REJECTED', admin_approved: false });
    expect(html).toContain('pill danger');
    expect(text(html)).toContain('Aceita pelo colega');
    expect(text(html)).toContain('Rejeitada pela coordenação');
  });

  it('cancelada pelo solicitante', () => {
    const t = text(build({ status: 'CANCELLED', target_confirmation: false, admin_approved_at: null, admin_approver: null }));
    expect(t).toContain('Cancelada pelo solicitante');
  });

  it('usa a logo embutida quando disponível e o nome em texto quando não', () => {
    const withLogo = buildSwapReceiptHtml(base, { logoDataUrl: 'data:image/png;base64,AAAA' });
    expect(withLogo).toContain('<img class="logo" src="data:image/png;base64,AAAA"');
    expect(build()).toContain('<div class="logo-text">Câmara Municipal de Macaé</div>');
  });
});

describe('formatPhoneBR', () => {
  it('formata celular e fixo com DDD, com ou sem 55', () => {
    expect(formatPhoneBR('22997604822')).toBe('(22) 99760-4822');
    expect(formatPhoneBR('5522997604822')).toBe('(22) 99760-4822');
    expect(formatPhoneBR('2227654321')).toBe('(22) 2765-4321');
  });

  it('mantém formatos desconhecidos e trata vazio', () => {
    expect(formatPhoneBR('123')).toBe('123');
    expect(formatPhoneBR(null)).toBe('');
  });
});
