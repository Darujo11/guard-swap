import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PWAUpdateChecker = () => {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleUpdate = () => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration?.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdateBanner(true);
        }
      });
    };

    // Check for updates on mount
    handleUpdate();

    // Listen for new service worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    // Check for updates periodically (every 5 minutes)
    const intervalId = setInterval(() => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
          registration.update().then(() => {
            if (registration.waiting) {
              setWaitingWorker(registration.waiting);
              setShowUpdateBanner(true);
            }
          });
        }
      });
    }, 5 * 60 * 1000); // 5 minutes

    // Listen for state changes on installing service worker
    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowUpdateBanner(true);
              }
            });
          }
        });
      }
    });

    return () => clearInterval(intervalId);
  }, []);

  const handleUpdate = async () => {
    if (waitingWorker) {
      // Tell the waiting service worker to take control
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    // Reload the page
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowUpdateBanner(false);
  };

  if (!showUpdateBanner) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-3 shadow-lg animate-in slide-in-from-top duration-300">
      <div className="container flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="font-medium">Nova versão disponível!</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleUpdate}
            className="font-semibold"
          >
            Atualizar Agora
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDismiss}
            className="h-8 w-8 hover:bg-primary-foreground/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
