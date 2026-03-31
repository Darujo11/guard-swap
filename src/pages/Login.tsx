import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoImage from '@/assets/logo.png';
import camaraBackground from '@/assets/logo3.jpg';
import logoCamara from '@/assets/logo-camara.png';
import PWAInstallButton from '@/components/PWAInstallButton';
import { APP_VERSION } from '@/lib/version';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await redirectUser(session.user.id);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsCheckingSession(false);
      }
    };
    checkUser();
  }, []);

  const redirectUser = async (userId: string) => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (roles && roles.length > 0) {
      // Prioridade: super_admin > admin > guard
      if (roles.some(r => r.role === 'super_admin')) {
        navigate('/super-admin/planos');
      } else if (roles.some(r => r.role === 'admin')) {
        navigate('/dashboard/admin');
      } else {
        navigate('/dashboard/guard');
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const raw = email.trim();
      const isPhone = /^\d+$/.test(raw);

      if (isPhone) {
        const digits = raw.replace(/\D/g, '');
        const e164 = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;

        let signedIn = false;
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            phone: e164,
            password,
          });
          if (!error && data.user) {
            await redirectUser(data.user.id);
            signedIn = true;
          }
        } catch (err) {
          // If phone login is disabled, we will fallback to email alias below
        }

        if (!signedIn) {
          const alias = `${digits}@guardshift.com`;
          const { data, error } = await supabase.auth.signInWithPassword({
            email: alias,
            password,
          });
          if (error) throw error;
          if (data.user) await redirectUser(data.user.id);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: raw,
          password,
        });
        if (error) throw error;
        if (data.user) await redirectUser(data.user.id);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: 'Erro no login',
        description: error.message || 'Credenciais inválidas. Verifique seu WhatsApp/Email e senha.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Show loader while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      {/* Background Image - Cobrindo toda a tela */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${camaraBackground})`,
          filter: 'contrast(1.15) saturate(1.3) brightness(1.05) blur(3px)'
        }}
      />
      
      {/* Overlay escuro para melhor legibilidade */}
      <div className="absolute inset-0 bg-background/70" />
      
      {/* PWA Install Button - Canto Superior Direito */}
      <div className="absolute top-4 right-4 z-20">
        <PWAInstallButton />
      </div>
      
      {/* Content */}
      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Logo Câmara no topo */}
        <div className="flex justify-center">
          <div className="bg-card/95 backdrop-blur-md rounded-lg px-6 py-4 shadow-lg border border-border/50">
            <img 
              src={logoCamara} 
              alt="Câmara Municipal de Macaé" 
              className="h-16 w-auto"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </div>
        
        <Card className="w-full shadow-2xl border-border/50 bg-card/95 backdrop-blur-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img src={logoImage} alt="Escala Smart" className="h-12 w-12" />
              <h1 className="text-2xl font-bold">Escala Smart</h1>
            </div>
            <CardTitle>Login</CardTitle>
            <CardDescription>
              Entre com suas credenciais para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">WhatsApp / Email</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="Digite seu WhatsApp ou email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Seguranças: use apenas números do WhatsApp (ex: 11999999999)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <PasswordInput
                  id="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-sm text-primary hover:underline underline-offset-2"
                >
                  Esqueceu a senha?
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription>
              Digite seu número de WhatsApp cadastrado. Uma nova senha será enviada para o seu WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-phone">Número do WhatsApp</Label>
              <Input
                id="forgot-phone"
                type="text"
                placeholder="Ex: 22999491428"
                value={forgotPhone}
                onChange={(e) => setForgotPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use apenas números, sem espaços ou caracteres especiais.
              </p>
            </div>
            <Button
              className="w-full"
              disabled={forgotLoading || !forgotPhone.trim()}
              onClick={async () => {
                setForgotLoading(true);
                try {
                  const { data, error } = await supabase.functions.invoke('forgot-password', {
                    body: { phone: forgotPhone.trim() },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  toast({
                    title: 'Senha enviada!',
                    description: data?.warning || 'Verifique seu WhatsApp para a nova senha.',
                  });
                  setForgotOpen(false);
                  setForgotPhone('');
                } catch (err: any) {
                  toast({
                    title: 'Erro',
                    description: err.message || 'Não foi possível recuperar a senha.',
                    variant: 'destructive',
                  });
                } finally {
                  setForgotLoading(false);
                }
              }}
            >
              {forgotLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar nova senha'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Footer with Version and Credits */}
      <div className="absolute bottom-4 left-0 right-0 z-10 text-center space-y-1">
        <span className="text-xs text-muted-foreground/70">
          Versão {APP_VERSION}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={async () => {
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (const registration of registrations) {
                await registration.unregister();
              }
            }
            const cacheKeys = await caches.keys();
            await Promise.all(cacheKeys.map(key => caches.delete(key)));
            window.location.reload();
          }}
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar Sistema
        </Button>
        <div className="text-xs text-muted-foreground/70">
          Feito com ❤️ por{' '}
          <a 
            href="https://wa.me/5522999491428" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium hover:text-primary transition-colors underline underline-offset-2"
          >
            VentureWise - Fabio Ventura
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
