import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWAInstallButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    console.log('PWA: Componente montado, aguardando evento beforeinstallprompt');
    const hasShownToast = sessionStorage.getItem('pwa-install-toast-shown');

    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('PWA: App já está instalado');
      return;
    }

    // Mostrar botão informativo após 3 segundos se o evento não disparar
    const timeout = setTimeout(() => {
      if (!isInstallable) {
        console.log('PWA: Evento beforeinstallprompt não disparou');
        setShowInfo(true);
      }
    }, 3000);

    const handler = (e: Event) => {
      console.log('PWA: Evento beforeinstallprompt recebido!');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
      clearTimeout(timeout);

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

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timeout);
    };
  }, [toast, isInstallable]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast({
        title: 'Instalação não disponível',
        description: 'Para instalar, acesse via Chrome/Edge no celular ou desktop, ou use o menu "Instalar app" do navegador.',
        variant: 'default',
      });
      return;
    }

    console.log('PWA: Mostrando prompt de instalação');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('PWA: Resultado da instalação:', outcome);

    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstallable(false);
      toast({
        title: '✅ App instalado!',
        description: 'O Escala Smart foi adicionado à sua tela inicial.',
      });
    }
  };

  // Mostrar botão se instalável ou se showInfo é true (para dar feedback)
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
