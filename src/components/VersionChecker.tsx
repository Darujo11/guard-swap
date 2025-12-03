import { useEffect } from 'react';
import { APP_VERSION } from '@/lib/version';
import { toast } from 'sonner';

export const VersionChecker = () => {
  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version');
    
    if (storedVersion && storedVersion !== APP_VERSION) {
      toast.info('Nova versão disponível! Atualizando...', {
        duration: 3000,
      });
      
      // Limpar caches e recarregar
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        });
      }
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    
    localStorage.setItem('app_version', APP_VERSION);
  }, []);

  return null;
};
