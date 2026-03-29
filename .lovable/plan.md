

## Plano: Botão de download PDF por folga registrada

### O que será feito

Adicionar um botão de download PDF em cada linha da tabela "Folgas Registradas", ao lado dos botões de editar e excluir. O PDF conterá os dados completos da folga: protocolo, nome do segurança, tipo de folga, período, dias, observações, data de registro e status.

### Alterações

#### 1. `src/pages/AdminLeaves.tsx`

- Importar `Download` do lucide-react
- Criar função `generateLeavePDF(leave: Leave)` que gera um PDF com:
  - Título: "Comprovante de Folga"
  - Protocolo (se existir, senão gerar um baseado no ID)
  - Nome do segurança
  - Tipo de folga (label legível)
  - Data inicial e final
  - Quantidade de dias
  - Observações
  - Data de registro
  - Status (PENDING/APPROVED/REJECTED traduzido)
  - Rodapé com "Gerado pelo Sistema Guard Swap" e linha de assinatura do coordenador
- Adicionar botão `Download` na coluna de ações de cada linha (ao lado de Editar e Excluir)

### Escopo
| Arquivo | Alteração |
|---------|-----------|
| `src/pages/AdminLeaves.tsx` | Função `generateLeavePDF` + botão de download por linha |

