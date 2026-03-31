

## Plano: Corrigir erro de hooks no useServiceWorker

### Problema

O erro `Rendered more hooks than during the previous render` está ocorrendo no `useServiceWorker.tsx`. Isso acontece porque o módulo `virtual:pwa-register/react` pode se comportar de forma inconsistente no contexto do preview (iframe), causando uma diferença na quantidade de hooks entre renders.

### Solução

Adicionar uma guarda no `useServiceWorker` para detectar se está rodando dentro de um iframe ou em domínio de preview do Lovable. Nesses casos, pular o registro do SW e retornar valores padrão sem chamar `useRegisterSW`, evitando o erro de hooks.

A abordagem será separar em dois componentes/hooks: um que detecta o contexto e outro que executa, garantindo que a quantidade de hooks seja sempre a mesma.

### Alteração

| Arquivo | Detalhe |
|---------|---------|
| `src/hooks/useServiceWorker.tsx` | Mover `useRegisterSW` para um componente interno sempre chamado, mas com lógica condicional dentro dos callbacks. Garantir ordem fixa de hooks. |

### Abordagem técnica

Criar dois hooks separados — `useServiceWorkerProd` (com `useRegisterSW`) e `useServiceWorkerNoop` (retorna valores dummy). Um wrapper no topo decide qual chamar baseado em detecção de iframe/preview, **mas** como não se pode chamar hooks condicionalmente, a solução será:

1. Sempre chamar `useRegisterSW` mas ignorar seus efeitos quando em preview
2. Ou mover a detecção para o `ServiceWorkerProvider` no `App.tsx` e renderizar condicionalmente o provider

A opção 2 é mais limpa: no `App.tsx`, verificar se está em iframe/preview e só renderizar o `ServiceWorkerProvider` nesse caso. Isso evita o problema de hooks completamente.

