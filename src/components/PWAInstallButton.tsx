import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const hasShownToast = sessionStorage.getItem('pwa-install-toast-shown');

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);

      // Mostrar toast apenas uma vez por sessão
      if (!hasShownToast) {
        sessionStorage.setItem('pwa-install-toast-shown', 'true');
        
        toast({
          title: '📱 Instale o Escala Smart',
          description: 'Adicione o app à sua tela inicial para acesso rápido e uso offline!',
          duration: 8000,
          action: (
            <Button
              size="sm"
              onClick={async () => {
                if (deferredPrompt) {
                  (e as BeforeInstallPromptEvent).prompt();
                  const { outcome } = await (e as BeforeInstallPromptEvent).userChoice;
                  if (outcome === 'accepted') {
                    setDeferredPrompt(null);
                    setIsInstallable(false);
                  }
                }
              }}
            >
              Instalar
            </Button>
          ),
        });
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [toast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  if (!isInstallable) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleInstallClick}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      Instalar App
    </Button>
  );
};

export default PWAInstallButton;
