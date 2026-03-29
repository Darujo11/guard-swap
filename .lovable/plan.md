

## Plano: Garantir envio de WhatsApp ao segurança na aprovação/rejeição da folga TRE

### Situação atual

O código já está completo:
- A edge function `notify-tre-leave-guard` já existe com a lógica correta de envio via Evolution API
- O `AdminDashboard.tsx` já chama essa function após aprovar/rejeitar (linha 171)
- A mensagem já inclui saudação dinâmica, nome do segurança, data e nome do coordenador

### Problema

A edge function pode não estar deployed no Supabase, retornando 404 quando chamada.

### Solução

Fazer um pequeno ajuste no arquivo da edge function (adicionar um log com timestamp) para forçar o redeploy automático. Nenhuma outra alteração é necessária.

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/notify-tre-leave-guard/index.ts` | Adicionar log para forçar redeploy |

