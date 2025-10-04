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

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        redirectUser(session.user.id);
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
      if (data.user) {
        // Check if user is active before redirecting
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_active')
          .eq('user_id', data.user.id)
          .single();

        if (profile && !profile.is_active) {
          await supabase.auth.signOut();
          toast({
            title: 'Acesso bloqueado',
            description: 'Seu período de teste expirou. Entre em contato para renovar sua assinatura.',
            variant: 'destructive',
          });
          return;
        }
        await redirectUser(data.user.id);
      }
    }
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: raw,
      password,
    });
    if (error) throw error;
    if (data.user) {
      // Check if user is active before redirecting
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('user_id', data.user.id)
        .single();

      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        toast({
          title: 'Acesso bloqueado',
          description: 'Seu período de teste expirou. Entre em contato para renovar sua assinatura.',
          variant: 'destructive',
        });
        return;
      }
      await redirectUser(data.user.id);
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
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

            <div className="text-center mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                Ainda não tem uma conta?
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => navigate('/teste-gratuito')}
              >
                Iniciar Teste Grátis de 7 Dias
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
