
## Plano: Remover Sistema de Atualização Automática

### Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/App.tsx` | MODIFICAR | Remover imports e uso dos componentes VersionChecker e PWAUpdateChecker |
| `src/components/VersionChecker.tsx` | DELETAR | Remover arquivo completo |
| `src/components/PWAUpdateChecker.tsx` | DELETAR | Remover arquivo completo |

---

### Detalhes Técnicos

#### 1. Modificar `src/App.tsx`

**Remover imports (linhas 8-9):**
```tsx
// REMOVER estas linhas:
import { VersionChecker } from "@/components/VersionChecker";
import { PWAUpdateChecker } from "@/components/PWAUpdateChecker";
```

**Remover uso dos componentes (linhas 36-37):**
```tsx
// REMOVER estas linhas dentro do App:
<VersionChecker />
<PWAUpdateChecker />
```

#### 2. Deletar `src/components/VersionChecker.tsx`
- Remove verificação de versão a cada 5 minutos
- Remove comparação com `version.json`
- Remove reload automático quando detecta nova versão

#### 3. Deletar `src/components/PWAUpdateChecker.tsx`
- Remove verificação de Service Worker a cada 5 minutos
- Remove banner "Nova versão disponível"
- Remove reload automático do PWA

---

### Arquivos que Permanecem (sem alteração)

Os seguintes arquivos podem continuar existindo pois não causam reload automático:
- `src/lib/version.ts` - apenas armazena a versão (pode ser útil para debug)
- `public/version.json` - arquivo estático de versão

---

### Resultado

Após essas alterações:
- O app não fará mais verificações periódicas de versão
- Não haverá mais reloads automáticos
- O banner "Nova versão disponível" não aparecerá mais
- O PWA ainda funcionará normalmente, mas não forçará atualizações
