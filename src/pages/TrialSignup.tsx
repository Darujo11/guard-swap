import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Loader2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import logoImage from '@/assets/logo.png';

const TrialSignup = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-trial-admin', {
        body: formData,
      });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Seu período de teste de 7 dias começou. Fazendo login...',
      });

      // Auto login after 2 seconds
      setTimeout(async () => {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (!signInError) {
          navigate('/dashboard/admin');
        }
      }, 2000);
    } catch (error: any) {
      console.error('Error creating trial admin:', error);
      toast({
        title: 'Erro ao criar conta',
        description: error.message || 'Tente novamente mais tarde.',
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
          <CardTitle>Teste Grátis de 7 Dias</CardTitle>
          <CardDescription>
            Comece agora sem compromisso. Não precisa cartão de crédito!
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!success ? (
            <>
              <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-primary mb-1">Incluso no período de teste:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>✓ Até 50 profissionais</li>
                      <li>✓ Equipes ilimitadas</li>
                      <li>✓ Gestão completa de escalas</li>
                      <li>✓ Sistema de trocas de plantões</li>
                      <li>✓ Suporte por email</li>
                    </ul>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp (opcional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="11999999999"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando sua conta...
                    </>
                  ) : (
                    'Começar Teste Gratuito'
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Ao criar sua conta, você concorda com nossos termos de uso
                </p>

                <div className="text-center">
                  <a
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Já tem uma conta? Faça login
                  </a>
                </div>
              </form>
            </>
          ) : (
            <div className="space-y-6 py-6">
              <div className="flex flex-col items-center justify-center">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Conta Criada!</h3>
                <p className="text-muted-foreground text-center">
                  Seu período de teste de 7 dias começou. Redirecionando...
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialSignup;
