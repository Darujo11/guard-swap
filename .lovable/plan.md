
## Plano: Atualizar Versão do App para 4.1.0

### Resumo
Atualizar a versão do aplicativo de **4.0.0** para **4.1.0** com a data de hoje (**2026-01-31**) em todos os arquivos de controle de versão.

---

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/lib/version.ts` | APP_VERSION: '4.0.0' → '4.1.0', BUILD_DATE: '2025-12-18' → '2026-01-31' |
| `public/version.json` | version: '4.0.0' → '4.1.0', buildDate: '2025-12-18' → '2026-01-31' |
| `index.html` | meta app-version: '4.0.0' → '4.1.0' |

---

### Detalhes das Alterações

#### 1. `src/lib/version.ts` (linha 2-3)

**Antes:**
```ts
export const APP_VERSION = '4.0.0';
export const BUILD_DATE = '2025-12-18';
```

**Depois:**
```ts
export const APP_VERSION = '4.1.0';
export const BUILD_DATE = '2026-01-31';
```

#### 2. `public/version.json` (linhas 2-3)

**Antes:**
```json
{
  "version": "4.0.0",
  "buildDate": "2025-12-18",
  "forceUpdate": true
}
```

**Depois:**
```json
{
  "version": "4.1.0",
  "buildDate": "2026-01-31",
  "forceUpdate": true
}
```

#### 3. `index.html` (linha 15)

**Antes:**
```html
<meta name="app-version" content="4.0.0" />
```

**Depois:**
```html
<meta name="app-version" content="4.1.0" />
```

---

### Resultado

Após as alterações, a versão **4.1.0** será exibida no menu do aplicativo e registrada em todos os arquivos de controle de versão.
