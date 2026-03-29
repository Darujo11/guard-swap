

## Plano: Botão de download PDF na lista de folgas TRE do segurança

### O que será feito

Adicionar um botão de download (ícone `Download`) em cada linha da lista "Folgas TRE Solicitadas" no dashboard do segurança. O PDF gerado terá os dados da folga: protocolo, nome do segurança, data, status e rodapé institucional.

### Alterações

#### `src/pages/GuardDashboard.tsx`

- Importar `Download` do lucide-react
- Criar função `generateTreLeavePDF(leave)` que gera um PDF com:
  - Título: "Comprovante de Folga TRE"
  - Protocolo (ou fallback baseado no ID)
  - Nome do segurança (`currentUser.name`)
  - Data da folga
  - Status traduzido
  - Rodapé: "Gerado pelo Sistema Guard Swap" + linha de assinatura do coordenador
- Adicionar botão com ícone `Download` ao lado do botão "Cancelar" em cada linha da lista de folgas TRE

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/GuardDashboard.tsx` | Função `generateTreLeavePDF` + botão download por linha |

