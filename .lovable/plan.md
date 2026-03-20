
Objetivo: corrigir o erro no envio da senha por WhatsApp no fluxo “Esqueceu a senha”.

1) Diagnóstico confirmado
- O código atual em `supabase/functions/forgot-password/index.ts` ainda chama:
  `https://evolution.autozapx.com/manager/message/sendText/escala`
- Os logs da função confirmam erro 404:
  `Cannot POST /manager/message/sendText/escala`
- Causa raiz: endpoint com `/manager` está incorreto para envio de mensagem.

2) Correção no backend (edge function)
- Arquivo: `supabase/functions/forgot-password/index.ts`
- Alterar apenas a URL de envio para:
  `https://evolution.autozapx.com/message/sendText/escala`
- Manter:
  - header `apikey: tokeninstancia`
  - body com `number` e `text`
  - lógica atual de reset de senha e resposta JSON

3) Ajuste de robustez da resposta (pequeno hardening)
- Melhorar mensagem de erro retornada quando a Evolution responder erro (exibir status + corpo de erro da API).
- Evitar mensagem genérica no front para facilitar suporte quando houver problema de token/instância.

4) Validação técnica após correção
- Testar a função diretamente com `supabase--curl_edge_functions` usando um telefone existente em `profiles`.
- Confirmar em logs que não há mais `Cannot POST /manager/...`.
- Confirmar retorno `success: true` sem `warning`.

5) Teste funcional fim a fim
- Na tela de login:
  - clicar em “Esqueceu a senha?”
  - informar WhatsApp cadastrado
  - validar recebimento da senha no WhatsApp
  - fazer login com a nova senha

Escopo de arquivos
- `supabase/functions/forgot-password/index.ts` (alteração principal)
- `src/pages/Login.tsx` só será alterado se precisar melhorar mensagem exibida ao usuário (opcional).
