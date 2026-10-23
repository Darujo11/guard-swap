# Assinatura Eletrônica das Trocas de Plantão

Em produção desde 2026-10-23 (versão 4.6.0). Cada ato de uma troca de plantão é assinado eletronicamente pela pessoa que o pratica, com confirmação de senha, e fica registrado de forma permanente.

> Enquadramento: assinatura eletrônica nos termos da Lei 14.063/2020. O art. 5º atribui a cada órgão definir, por ato normativo, o nível de assinatura aceito em cada tipo de interação. A validade deste mecanismo para as trocas de plantão depende de ato da Câmara (portaria/ato da Mesa) — a ser confirmado pela Procuradoria.

---

## 1. Atos assinados

| Ato | Quem | Declaração exibida e gravada |
|---|---|---|
| `SOLICITOU` | solicitante | Declaro que solicito a troca de plantão nos termos acima. |
| `ACEITOU` | colega | Declaro que li e aceito a troca de plantão nos termos acima. |
| `RECUSOU` | colega | Declaro que recuso a troca de plantão nos termos acima. |
| `CANCELOU` | solicitante | Declaro que cancelo a minha solicitação de troca de plantão. |
| `APROVOU` | coordenação | Na qualidade de coordenação, aprovo a troca de plantão nos termos acima. |
| `REJEITOU` | coordenação | Na qualidade de coordenação, rejeito a troca de plantão nos termos acima. |

Os textos estão em `public.swap_signature_declaration()` (banco) e em `src/lib/swapSignatureText.ts` (tela) — mudar nos dois lugares.

---

## 2. Como funciona

```text
Tela (SignatureFields): declaração marcada + senha
        │
        ▼
signSwapAction (src/lib/swapSignature.ts)
  1. signInWithPassword numa sessão DESCARTÁVEL (não mexe na sessão do app)
  2. confere que é o mesmo usuário logado
  3. faz o insert/update da troca com essa sessão
  4. encerra a sessão descartável (signOut scope local)
        │
        ▼
Banco (migration 20261023150000_swap_signatures.sql)
  BEFORE trg_enforce_swap_signature_rules
     - exige senha digitada há ≤ 5 min (claim `amr` do JWT, método "password")
     - termos congelados: pessoas, datas, motivo e organização não mudam depois de solicitada
  AFTER  trg_record_swap_signature
     - grava a assinatura em swap_signatures
```

O que fica registrado em `swap_signatures`:

| Campo | Conteúdo |
|---|---|
| `action`, `signer_role` | ato e papel (solicitante / colega / coordenação) |
| `signer_user_id`, `signer_profile_id`, `signer_name` | quem assinou |
| `declaration` | texto exato da declaração aceita |
| `terms` | termos assinados (pessoas, datas, motivo, organização, nomes) |
| `terms_hash` | SHA-256 dos termos (sem os nomes) |
| `verification_code` | 10 primeiros caracteres do hash, ex. `3FA9C-0B71E` (o mesmo para todos os atos da troca) |
| `password_confirmed_at` | quando a senha foi confirmada (do JWT) |
| `ip`, `user_agent` | de onde (cabeçalhos da requisição) |
| `signed_at` | hora do servidor |

Garantias:

- **Append-only:** `trg_swap_signatures_immutable` bloqueia UPDATE e DELETE para qualquer papel, inclusive service role.
- **Sem FK para `swap_requests`:** a assinatura sobrevive se a troca for excluída.
- **Leitura:** quem enxerga a troca (RLS de `swap_requests`) enxerga as assinaturas; anon não lê a tabela.
- **Service role / SQL Editor** (sem `auth.uid()`) não passa pelas regras nem gera assinatura — mesmo critério de `enforce_swap_request_transition`.

---

## 3. Comprovante e verificação

- O comprovante impresso (`src/utils/swapReceipt.ts`) lista as assinaturas (papel, nome, ato, data/hora com segundos, IP) e o código de verificação. Trocas anteriores à assinatura eletrônica saem com linhas para assinatura manual.
- Página pública `https://escalasmart.com.br/#/verificar/<código>` → RPC `verify_swap_document(código)`:
  - mostra protocolo, datas, situação e as assinaturas;
  - por privacidade, só primeiro nome + inicial do sobrenome; sem motivo, telefone ou IP;
  - avisa se os termos atuais da troca não conferem com os assinados, ou se a troca foi excluída.
- As mensagens de WhatsApp de aprovação trazem o código de verificação.

---

## 4. Limitações conhecidas

- A força da assinatura depende da senha. Com a senha padrão `123456` ainda em uso, a prova de autoria é fraca.
- Não há QR code no comprovante (pendente: nova dependência + confirmar o lockfile do build).
- Trocas feitas antes de 2026-10-23 não têm assinatura eletrônica.

---

## 5. Operação

```sql
-- Assinaturas de uma troca
select action, signer_role, signer_name, signed_at, ip, verification_code
  from swap_signatures where swap_id = '<id>' order by signed_at;

-- Conferir um código como a página pública faz
select public.verify_swap_document('3FA9C-0B71E');
```

Remover assinaturas de teste exige desligar o trigger de imutabilidade como dono da tabela (`alter table swap_signatures disable trigger trg_swap_signatures_immutable`) e religar logo depois — só para dados de teste, nunca para assinaturas reais.
