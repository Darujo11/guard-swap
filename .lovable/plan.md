

## Plano: Atualizar versão para 4.1.7

Atualizar os dois arquivos de versão do sistema:

| Arquivo | Campo | De | Para |
|---------|-------|----|------|
| `public/version.json` | `version` | `4.1.6` | `4.1.7` |
| `public/version.json` | `buildDate` | `2026-03-31` | `2026-04-07` |
| `src/lib/version.ts` | `APP_VERSION` | `4.1.6` | `4.1.7` |
| `src/lib/version.ts` | `BUILD_DATE` | `2026-04-02` | `2026-04-07` |

Manter `forceUpdate: true` no `version.json` para garantir que todos os usuários recebam a atualização.

