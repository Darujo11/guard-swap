import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

function getMillisecondsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export function useServiceWorker() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Agenda primeira verificação para meia-noite
        const msUntilMidnight = getMillisecondsUntilMidnight();

        setTimeout(() => {
          r.update();
          // Depois da primeira verificação, verifica a cada 24 horas
          setInterval(() => {
            r.update();
          }, 24 * 60 * 60 * 1000);
        }, msUntilMidnight);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast('Nova versão disponível!', {
        description: 'Clique para atualizar o aplicativo.',
        duration: Infinity,
        action: {
          label: 'Atualizar',
          onClick: () => {
            updateServiceWorker(true);
          },
        },
        onDismiss: () => setNeedRefresh(false),
      });
    }
  }, [needRefresh, updateServiceWorker, setNeedRefresh]);

  return { needRefresh, updateServiceWorker };
}
