

## Plano: Fluxo de aprovação de folga TRE com notificação e PDF

### Resumo
Atualmente a folga TRE é registrada diretamente. Vamos adicionar um fluxo de aprovação: o segurança solicita → aparece no dashboard do admin → admin aprova/rejeita → WhatsApp enviado ao segurança → dia aparece em vermelho com "Folga TRE" no calendário.

### Alterações

#### 1. Migração SQL — Adicionar coluna `status` à tabela `leaves`

```sql
ALTER TABLE public.leaves ADD COLUMN status text NOT NULL DEFAULT 'PENDING';

-- Atualizar registros existentes para APPROVED
UPDATE public.leaves SET status = 'APPROVED' WHERE status = 'PENDING';

-- Adicionar coluna protocol (número sequencial único)
ALTER TABLE public.leaves ADD COLUMN protocol text;
```

#### 2. `src/pages/AdminDashboard.tsx` — Seção de solicitações TRE pendentes

- Buscar `leaves` com `leave_type = 'TRE'` e `status = 'PENDING'` e `admin_id = profile.id`
- Exibir card "Solicitações de Folga TRE" (similar ao card de trocas) com:
  - Nome do segurança, data da folga, data da solicitação
  - Botões "Aprovar" e "Rejeitar"
- Ao aprovar:
  - Atualizar `status = 'APPROVED'` na tabela `leaves`
  - Chamar nova edge function `notify-tre-leave-guard` para enviar WhatsApp ao segurança
- Ao rejeitar:
  - Atualizar `status = 'REJECTED'`
  - Enviar WhatsApp ao segurança informando a rejeição
- Botão de download PDF com dados da solicitação (protocolo, segurança, data, status)

#### 3. Nova Edge Function `supabase/functions/notify-tre-leave-guard/index.ts`

- Recebe: `guard_phone`, `guard_name`, `leave_date`, `admin_name`, `approved` (boolean)
- Envia WhatsApp ao segurança via Evolution API:
  - Aprovado: "Bom dia [Nome], sua folga TRE do dia [data] foi autorizada pelo coordenador [AdminName]."
  - Rejeitado: "Bom dia [Nome], sua folga TRE do dia [data] foi rejeitada pelo coordenador [AdminName]."

#### 4. `src/pages/GuardDashboard.tsx` — Ajustes

- Ao inserir folga TRE, usar `status: 'PENDING'` (ao invés de inserir já aprovada)
- Gerar `protocol` único no formato `TRE-YYYYMMDD-XXXX` (timestamp + random)
- Na lista de folgas TRE, mostrar status (Pendente/Aprovada/Rejeitada) com badge colorido
- Só permitir cancelar folgas com status `PENDING`

#### 5. `src/components/schedule/GuardPersonalCalendar.tsx` — Mostrar folgas TRE aprovadas

- Buscar `leaves` com `leave_type = 'TRE'`, `status = 'APPROVED'`, `guard_id`
- Dias com folga TRE aprovada: fundo vermelho + texto "Folga TRE"
- Adicionar legenda "Folga TRE" com cor vermelha

#### 6. PDF de download da solicitação (no admin)

- Gerar PDF com:
  - Protocolo, nome do segurança, data da folga, data da solicitação
  - Status (Aprovado/Rejeitado/Pendente)
  - Assinatura do coordenador (nome)

### Fluxo completo
1. Segurança clica "Solicitar Folga TRE" → escolhe dia → confirma
2. Registro criado com `status = 'PENDING'` + protocolo
3. WhatsApp enviado ao admin (já existente)
4. Admin vê no dashboard → aprova ou rejeita
5. WhatsApp enviado ao segurança com resultado
6. Se aprovada → dia fica vermelho com "Folga TRE" no calendário do segurança
7. Admin pode baixar PDF da solicitação

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Adicionar `status` e `protocol` à tabela `leaves` |
| `src/pages/AdminDashboard.tsx` | Card de solicitações TRE pendentes com aprovar/rejeitar/download |
| `supabase/functions/notify-tre-leave-guard/index.ts` | Nova edge function para WhatsApp ao segurança |
| `src/pages/GuardDashboard.tsx` | Insert com status PENDING + protocolo, mostrar status na lista |
| `src/components/schedule/GuardPersonalCalendar.tsx` | Buscar folgas TRE aprovadas, renderizar em vermelho |
| `src/utils/pdfGenerator.ts` | Incluir folgas TRE no PDF da escala |

