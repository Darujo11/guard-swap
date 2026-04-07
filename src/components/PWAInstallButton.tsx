import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Info } from 'lucide-react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallButton = () => {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const timeout = setTimeout(() => {
      if (!promptRef.current) setShowInfo(true);
    }, 3000);

    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
      clearTimeout(timeout);

      const hasShown = sessionStorage.getItem('pwa-install-toast-shown');
      if (!hasShown) {
        sessionStorage.setItem('pwa-install-toast-shown', 'true');
        toast('📱 Instale o Escala Smart', {
          description: 'Adicione o app à sua tela inicial para acesso rápido!',
          duration: 8000,
        });
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timeout);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!promptRef.current) {
      toast.info('Como instalar', {
        description: 'No Chrome/Edge, toque no menu (⋮) e selecione "Instalar app" ou "Adicionar à tela inicial".',
        duration: 10000,
      });
      return;
    }

    promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;

    if (outcome === 'accepted') {
      promptRef.current = null;
      setIsInstallable(false);
      toast.success('App instalado!', {
        description: 'O Escala Smart foi adicionado à sua tela inicial.',
      });
    }
  };

  if (!isInstallable && !showInfo) return null;

  return (
    <Button
      variant={isInstallable ? "default" : "outline"}
      size="sm"
      onClick={handleInstallClick}
      className="gap-2"
    >
      {isInstallable ? (
        <>
          <Download className="h-4 w-4" />
          Instalar App
        </>
      ) : (
        <>
          <Info className="h-4 w-4" />
          Como instalar
        </>
      )}
    </Button>
  );
};

export default PWAInstallButton;
