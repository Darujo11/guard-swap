import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logoImage from '@/assets/logo.png';
import PWAInstallButton from '@/components/PWAInstallButton';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <PWAInstallButton />
      </div>
      <Card className="w-full max-w-md">
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
              <Input
                id="password"
                type="password"
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
