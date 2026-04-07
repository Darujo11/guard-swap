

## Plano: Corrigir botão de instalação do PWA

### Problema
O componente `PWAInstallButton` tem dois bugs:

1. **Closure stale no toast**: O botão "Instalar" dentro do toast verifica `if (deferredPrompt)`, mas captura o valor inicial `null` do estado. O prompt nunca é chamado.
2. **Re-render perde o evento**: O `useEffect` depende de `isInstallable`, o que causa re-registro do listener e pode perder o evento `beforeinstallprompt` salvo.

### Correção em `src/components/PWAInstallButton.tsx`

1. **Usar `useRef`** para guardar o `deferredPrompt` em vez de (ou além de) `useState`, evitando problemas de closure stale.
2. **Remover `isInstallable` das dependências** do `useEffect` para não re-registrar o listener.
3. **Simplificar o toast**: Em vez de colocar um botão com lógica complexa dentro do toast, o toast apenas informa — o botão principal faz a instalação.
4. **Fallback "Como instalar"**: Quando o evento não dispara (iOS, navegadores sem suporte), mostrar instruções claras de como instalar manualmente.

### Código resumido da correção

```typescript
const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

useEffect(() => {
  const handler = (e: Event) => {
    e.preventDefault();
    promptRef.current = e as BeforeInstallPromptEvent;
    setIsInstallable(true);
  };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}, []); // sem dependências extras

const handleInstallClick = async () => {
  if (!promptRef.current) {
    // mostrar instruções manuais
    return;
  }
  promptRef.current.prompt();
  const { outcome } = await promptRef.current.userChoice;
  if (outcome === 'accepted') {
    promptRef.current = null;
    setIsInstallable(false);
  }
};
```

### Arquivo alterado
- `src/components/PWAInstallButton.tsx`

