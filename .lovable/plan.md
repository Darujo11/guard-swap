

## Plano: Corrigir envio de WhatsApp ao solicitar folga TRE

### Problema
A edge function `notify-tre-leave` existe no código mas **não está implantada (deployed)** no Supabase — retorna 404. Por isso a mensagem nunca é enviada.

### Solução

#### 1. Forçar deploy da edge function
A função já está correta em `supabase/functions/notify-tre-leave/index.ts`. Basta fazer um pequeno ajuste (adicionar log) para forçar o deploy automático.

#### 2. Verificar telefone do admin no banco
A função busca o telefone do admin na tabela `profiles` pelo `admin_id`. Se o campo `phone` do admin estiver vazio ou incorreto, a mensagem não será enviada. Garantir que o número `5522992618308` está salvo no perfil do admin.

### Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/notify-tre-leave/index.ts` | Adicionar log inicial para forçar redeploy + melhorar tratamento de erros |

### Verificação pós-deploy
Após o deploy, testar a função diretamente para confirmar que está acessível e enviando a mensagem corretamente.

