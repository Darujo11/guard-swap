// deno test supabase/functions/_shared/messages.test.ts
// (com PRINT=1 imprime todas as mensagens de exemplo, para revisar o texto)
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  passwordReset,
  shortDate,
  shortDateFromBR,
  swapMessages,
  swapProtocol,
  swapReminder,
  treDecisionToGuard,
  treRequestToCoordinator,
  type SwapMessageData,
} from './messages.ts';

// 23/10/2026 11:00 em Brasília (14:00 UTC) -> "Bom dia"
const NOW = new Date('2026-10-23T14:00:00Z');

const swap: SwapMessageData = {
  swapId: '0920e7eb-d78d-4b64-bf9d-42ecc9c1ad82',
  requester: 'Philipe',
  target: 'Fabio',
  requesterDate: '2026-10-01',
  targetDate: '2026-10-20',
  reason: 'Consulta médica',
  coordinator: 'Coordenador Morais',
  decidedBy: 'Coordenador Morais',
  verificationCode: '3FA9C-0B71E',
};

const all: Record<string, string> = {
  '1. solicitada -> colega': swapMessages.requestedToTarget(swap, NOW),
  '2. solicitada -> solicitante': swapMessages.requestedToRequester(swap, NOW),
  '3. aceita -> coordenação': swapMessages.acceptedToCoordinator(swap, NOW),
  '4. aceita -> solicitante': swapMessages.acceptedToRequester(swap, NOW),
  '5. aprovada -> solicitante': swapMessages.approvedToRequester(swap, NOW),
  '6. aprovada -> colega': swapMessages.approvedToTarget(swap, NOW),
  '7. rejeitada coordenação -> solicitante': swapMessages.rejectedByCoordinatorToRequester(swap, NOW),
  '8. rejeitada coordenação -> colega': swapMessages.rejectedByCoordinatorToTarget(swap, NOW),
  '9. recusada pelo colega -> solicitante': swapMessages.rejectedByTargetToRequester(swap, NOW),
  '10. cancelada -> colega': swapMessages.cancelledToTarget(swap, NOW),
  '11. lembrete 8h': swapReminder(
    { swapId: swap.swapId, name: 'Fabio', otherName: 'Philipe', shiftDate: '2026-10-01', otherShiftDate: '2026-10-20' },
    NOW
  ),
  '12. TRE pedido -> coordenação': treRequestToCoordinator(
    { coordinator: 'Coordenador Morais', guard: 'Philipe', leaveDate: '05/11/2026', remainingDays: 2 },
    NOW
  ),
  '13a. TRE autorizada': treDecisionToGuard(
    { guard: 'Philipe', leaveDate: '05/11/2026', coordinator: 'Coordenador Morais', approved: true },
    NOW
  ),
  '13b. TRE não autorizada': treDecisionToGuard(
    { guard: 'Philipe', leaveDate: '05/11/2026', coordinator: 'Coordenador Morais', approved: false },
    NOW
  ),
  '14. nova senha': passwordReset({ name: 'Philipe', password: '482913' }, NOW),
};

if (Deno.env.get('PRINT')) {
  for (const [name, text] of Object.entries(all)) console.log(`\n===== ${name}\n${text}`);
}

Deno.test('datas com dia da semana certo', () => {
  assertEquals(shortDate('2026-10-01'), 'qui, 01/10');
  assertEquals(shortDate('2026-10-20'), 'ter, 20/10');
  assertEquals(shortDate('2026-11-08'), 'dom, 08/11');
  assertEquals(shortDateFromBR('05/11/2026'), 'qui, 05/11');
  assertEquals(shortDateFromBR('amanhã'), 'amanhã');
});

Deno.test('lembrete sem vírgula dupla na data', () => {
  assertStringIncludes(all['11. lembrete 8h'], 'Lembrete: *amanhã (qui, 01/10)*, você cobre o plantão de Philipe');
});

Deno.test('protocolo no mesmo formato do comprovante', () => {
  assertEquals(swapProtocol(swap.swapId), 'TRC-0920E7EB');
});

Deno.test('nenhuma mensagem tem aviso de mensagem automática nem artigo antes de nome', () => {
  for (const [name, text] of Object.entries(all)) {
    assert(!/autom[aá]tica/i.test(text), `${name} ainda tem "mensagem automática"`);
    assert(!/\b(o|a) (Philipe|Fabio)\b/.test(text), `${name} tem artigo antes de nome`);
    assert(!/meu amigo|o segurança|chefia/i.test(text), `${name} tem tratamento antigo`);
    assert(text.startsWith('Bom dia, '), `${name} sem saudação com nome`);
  }
});

Deno.test('lista os dias em ordem e diz quem trabalha em cada um', () => {
  const text = swapMessages.approvedToTarget(swap, NOW);
  assert(text.indexOf('qui, 01/10') < text.indexOf('ter, 20/10'));
  assertStringIncludes(text, '• *qui, 01/10* – você trabalha, no lugar de Philipe');
  assertStringIncludes(text, '• *ter, 20/10* – você fica de folga (Philipe cobre)');

  // Mesmo se o plantão do colega vier antes, a lista sai em ordem de data
  const inverted = swapMessages.approvedToTarget({ ...swap, requesterDate: '2026-10-20', targetDate: '2026-10-01' }, NOW);
  assert(inverted.indexOf('qui, 01/10') < inverted.indexOf('ter, 20/10'));
  assertStringIncludes(inverted, '• *qui, 01/10* – você fica de folga (Philipe cobre)');
});

Deno.test('aprovação traz o código de verificação; sem código, só o protocolo', () => {
  assertStringIncludes(swapMessages.approvedToRequester(swap, NOW), 'Protocolo TRC-0920E7EB · Verificação 3FA9C-0B71E');
  const semCodigo = swapMessages.approvedToRequester({ ...swap, verificationCode: null }, NOW);
  assertStringIncludes(semCodigo, 'Protocolo TRC-0920E7EB');
  assert(!semCodigo.includes('Verificação'));
});

Deno.test('sem nome de quem decidiu, fala em "coordenação"', () => {
  assertStringIncludes(
    swapMessages.approvedToRequester({ ...swap, decidedBy: null }, NOW),
    'foi *aprovada* pela coordenação.'
  );
  assertStringIncludes(treDecisionToGuard({ guard: 'Ana', leaveDate: '05/11/2026', coordinator: null, approved: true }, NOW), 'pela coordenação');
});

Deno.test('motivo vazio não deixa linha "Motivo:" solta', () => {
  assert(!swapMessages.requestedToTarget({ ...swap, reason: '  ' }, NOW).includes('Motivo'));
});

Deno.test('folga TRE: singular e plural do saldo', () => {
  assertStringIncludes(treRequestToCoordinator({ coordinator: 'X', guard: 'Ana', leaveDate: '05/11/2026', remainingDays: 1 }, NOW), 'Ainda resta 1 folga TRE');
  assertStringIncludes(treRequestToCoordinator({ coordinator: 'X', guard: 'Ana', leaveDate: '05/11/2026', remainingDays: 3 }, NOW), 'Ainda restam 3 folgas TRE');
});

Deno.test('saudação muda com o horário de Brasília', () => {
  assert(passwordReset({ name: 'Ana', password: '1' }, new Date('2026-10-23T17:00:00Z')).startsWith('Boa tarde, Ana!'));
  assert(passwordReset({ name: 'Ana', password: '1' }, new Date('2026-10-23T23:30:00Z')).startsWith('Boa noite, Ana!'));
});
