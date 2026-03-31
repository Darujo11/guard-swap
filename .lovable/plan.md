

## Plano: Melhorar visual do botão Atualizar Sistema no Login

### Alteração

| Arquivo | Detalhe |
|---------|---------|
| `src/pages/Login.tsx` | Redesenhar o footer: versão e botão em linha, botão com estilo `ghost` e cor suave, integrado ao rodapé de forma elegante sem parecer um botão "solto" |

### Design

O footer será reorganizado com layout `flex` centralizado:
- Versão e botão de atualizar na mesma linha, separados por um ponto
- Botão estilizado como link discreto com ícone pequeno (ghost, texto `muted-foreground`)
- Créditos na linha de baixo
- Tudo compacto e harmonioso com o visual da página

```text
       v4.1.6 · 🔄 Atualizar Sistema
    Feito com ❤️ por VentureWise - Fabio Ventura
```

