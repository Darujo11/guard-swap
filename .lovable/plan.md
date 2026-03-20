

## Plano: Personalizar mensagem WhatsApp com saudação dinâmica

### Alteração

**Arquivo:** `supabase/functions/forgot-password/index.ts`

Substituir a mensagem atual (linha 85) por uma versão personalizada com saudação baseada no horário (Bom dia / Boa tarde / Boa noite) e tom informal conforme solicitado.

**Lógica de saudação:**
- 6h–12h → "Bom dia"
- 12h–18h → "Boa tarde"  
- 18h–6h → "Boa noite"

Usar fuso horário de Brasília (`America/Sao_Paulo`, UTC-3).

**Nova mensagem:**
```
{saudação} meu amigo {nome}! 

Sua nova senha é: *{senha}*

Qualquer dúvida só me chamar por aqui. Recomendo alterar a senha no sistema. Tmj 💪
```

### Escopo
- Apenas a edge function `forgot-password` será modificada (linhas ~83-86)
- Adicionar cálculo de hora em Brasília antes do fetch

