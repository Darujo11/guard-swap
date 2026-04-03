

## Plano: Adicionar edição e exclusão na tabela de cotas TRE

### Contexto
A lista de "Afastamentos Registrados" já possui botões de editar e apagar funcionais. Porém a tabela de **saldos TRE** (dentro do card "Afastamentos TRE") só exibe os dados sem opção de editar ou excluir.

### Alterações

| Arquivo | Detalhe |
|---------|---------|
| `src/pages/AdminLeaves.tsx` | Adicionar coluna "Ações" na tabela de cotas TRE com botões Editar e Excluir |

### Funcionalidades

1. **Botão Editar (lápis)**: Ao clicar, preenche o formulário acima com os dados da cota (seleciona o segurança, preenche total e já tiradas), permitindo re-salvar
2. **Botão Excluir (lixeira)**: Abre confirmação e deleta o registro da tabela `guard_tre_quotas`

### Tabela atualizada

```text
Segurança      | Total TRE | Já Tiradas | Saldo | Ações
Carlos Almeida |    21     |     8      |  13   | ✏️ 🗑️
```

### Detalhes técnicos
- Botão editar: seta `treGuard`, `treDays` e `trePreUsed` com os valores da linha clicada
- Botão excluir: usa `AlertDialog` para confirmação, depois executa `DELETE` na tabela `guard_tre_quotas` e atualiza o estado
- Reutiliza o mesmo padrão visual dos botões de ação da lista de afastamentos

