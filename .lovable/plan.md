

## Plano: Forçar atualização automática para todos os usuários

### Problema

O Service Worker atual só verifica atualizações **uma vez por dia à meia-noite**. Mesmo com `skipWaiting: true` e `clientsClaim: true` no Workbox, o SW antigo fica em cache e o usuário precisa fechar todas as abas ou esperar até meia-noite para receber a nova versão. Além disso, o toast de atualização pode ser **dispensado** pelo usuário sem atualizar.

### Solução

Três melhorias combinadas:

#### 1. Verificar atualizações com frequência (a cada 15 minutos)
Trocar a verificação de "1x à meia-noite" para a cada 15 minutos, garantindo que o usuário receba a nova versão rapidamente.

#### 2. Polling do `version.json` com atualização forçada
Adicionar um mecanismo independente que consulta `/version.json` a cada 5 minutos. Se a versão remota for diferente da `APP_VERSION` local **e** `forceUpdate: true`, força reload automático (sem perguntar ao usuário).

#### 3. Toast não dispensável para atualizações normais
Quando `forceUpdate: false`, mostrar toast sem botão de fechar — apenas o botão "Atualizar".

### Alterações

| Arquivo | O que muda |
|---------|-----------|
| `src/hooks/useServiceWorker.tsx` | Intervalo de verificação do SW de 24h → 15min. Adicionar polling de `version.json` a cada 5min com reload forçado quando `forceUpdate: true`. |
| `src/lib/version.ts` | Exportar `APP_VERSION` (já existe, sem mudança) |
| `public/version.json` | Incrementar versão para `4.1.5` |
| `src/lib/version.ts` | Incrementar para `4.1.5` |

### Fluxo

```text
App inicia → useServiceWorker:
  1. Registra SW com verificação a cada 15min
  2. Inicia polling de /version.json a cada 5min (cache-busted com ?t=timestamp)
     → Se versão remota ≠ APP_VERSION e forceUpdate=true:
        → Limpa caches + unregister SW + location.reload()
     → Se versão remota ≠ APP_VERSION e forceUpdate=false:
        → Toast "Nova versão disponível" (não dispensável)
  3. SW detecta mudança → needRefresh → toast ou auto-reload
```

### Detalhe técnico do polling

```typescript
// Fetch com cache-bust para evitar cache do SW/CDN
const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
const data = await res.json();
if (data.version !== APP_VERSION) {
  if (data.forceUpdate) {
    // Limpa tudo e recarrega
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    window.location.reload();
  }
}
```

Isso resolve o problema pois mesmo que o SW esteja cacheando a app antiga, o `version.json` está configurado como `NetworkOnly` no Workbox e o fetch usa `cache: 'no-store'`, garantindo que sempre busca a versão real do servidor.

