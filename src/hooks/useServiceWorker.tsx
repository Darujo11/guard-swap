import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { APP_VERSION } from '@/lib/version';

const SW_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
const VERSION_POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function forceReload() {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  window.location.reload();
}

export function useServiceWorker() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Check for SW updates every 15 minutes
        setInterval(() => {
          r.update();
        }, SW_CHECK_INTERVAL);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  // Version polling independent of SW
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.version && data.version !== APP_VERSION) {
          if (data.forceUpdate) {
            await forceReload();
          } else {
            toast('Nova versão disponível!', {
              description: 'Clique para atualizar o aplicativo.',
              duration: Infinity,
              action: {
                label: 'Atualizar',
                onClick: () => forceReload(),
              },
            });
          }
        }
      } catch (e) {
        // silently ignore fetch errors
      }
    };

    // First check after 30 seconds, then every 5 minutes
    const timeout = setTimeout(() => {
      checkVersion();
      interval = setInterval(checkVersion, VERSION_POLL_INTERVAL);
    }, 30000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  // SW-level needRefresh fallback
  useEffect(() => {
    if (needRefresh) {
      toast('Nova versão disponível!', {
        description: 'Clique para atualizar o aplicativo.',
        duration: Infinity,
        action: {
          label: 'Atualizar',
          onClick: () => updateServiceWorker(true),
        },
        onDismiss: () => setNeedRefresh(false),
      });
    }
  }, [needRefresh, updateServiceWorker, setNeedRefresh]);

  return { needRefresh, updateServiceWorker };
}
