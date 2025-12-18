import { useEffect } from 'react';
import { APP_VERSION } from '@/lib/version';
import { toast } from 'sonner';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

const clearAllCaches = async () => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
};

const unregisterServiceWorkers = async () => {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
  }
};

export const forceAppUpdate = async () => {
  toast.info('Atualizando aplicação...', { duration: 2000 });
  
  try {
    await clearAllCaches();
    await unregisterServiceWorkers();
  } catch (e) {
    console.error('Erro ao limpar caches:', e);
  }
  
  // Force reload bypassing cache
  setTimeout(() => {
    window.location.href = window.location.href.split('?')[0] + '?v=' + Date.now();
  }, 500);
};

const checkServerVersion = async () => {
  try {
    // Add cache-busting parameter
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return data;
  } catch (e) {
    console.error('Erro ao verificar versão do servidor:', e);
    return null;
  }
};

const compareVersions = (local: string, server: string): number => {
  const localParts = local.split('.').map(Number);
  const serverParts = server.split('.').map(Number);
  
  for (let i = 0; i < Math.max(localParts.length, serverParts.length); i++) {
    const localPart = localParts[i] || 0;
    const serverPart = serverParts[i] || 0;
    
    if (serverPart > localPart) return 1;
    if (serverPart < localPart) return -1;
  }
  
  return 0;
};

export const VersionChecker = () => {
  useEffect(() => {
    const storedVersion = localStorage.getItem('app_version');
    const lastCheck = localStorage.getItem('version_last_check');
    const now = Date.now();
    
    // Check if local version changed (for immediate updates)
    if (storedVersion && storedVersion !== APP_VERSION) {
      console.log(`[VersionChecker] Local version changed: ${storedVersion} -> ${APP_VERSION}`);
      localStorage.setItem('app_version', APP_VERSION);
      localStorage.setItem('version_last_check', String(now));
      
      toast.success('Aplicação atualizada!', {
        description: `Versão ${APP_VERSION}`,
        duration: 3000,
      });
      return;
    }
    
    // Store current version
    localStorage.setItem('app_version', APP_VERSION);
    
    // Check server version
    const performServerCheck = async () => {
      const serverData = await checkServerVersion();
      
      if (!serverData) return;
      
      const comparison = compareVersions(APP_VERSION, serverData.version);
      
      if (comparison > 0 || serverData.forceUpdate) {
        console.log(`[VersionChecker] Server has newer version: ${serverData.version} (local: ${APP_VERSION})`);
        
        toast.info('Nova versão disponível! Atualizando...', {
          duration: 3000,
        });
        
        // Clear caches and reload
        await clearAllCaches();
        
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      
      localStorage.setItem('version_last_check', String(Date.now()));
    };
    
    // Check on mount if enough time has passed
    const timeSinceLastCheck = lastCheck ? now - parseInt(lastCheck, 10) : Infinity;
    if (timeSinceLastCheck > VERSION_CHECK_INTERVAL) {
      performServerCheck();
    }
    
    // Set up periodic checks
    const intervalId = setInterval(performServerCheck, VERSION_CHECK_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, []);

  return null;
};
