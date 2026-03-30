

## Plano: Forçar atualização do sistema para todos os usuários

### O que será feito

Incrementar a versão da aplicação para 4.1.4 e manter `forceUpdate: true`, garantindo que todos os usuários recebam a versão mais recente com as alterações de afastamentos e upload de documentos.

### Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/version.ts` | `4.1.3` → `4.1.4`, `buildDate` → `2026-03-30` |
| `public/version.json` | `4.1.3` → `4.1.4`, `buildDate` → `2026-03-30` |
| `index.html` | Atualizar meta tag de versão se existir |

Após as alterações, será necessário publicar o projeto para que os usuários recebam a atualização.

