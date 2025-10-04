import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import logoImage from '@/assets/logo.png';

const CreateAdmin = () => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const createAdminUser = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-admin');

      if (error) throw error;

      setSuccess(true);
      toast({
        title: 'Admin criado com sucesso!',
        description: 'Você já pode fazer login com as credenciais exibidas.',
      });
    } catch (error: any) {
      console.error('Error creating admin:', error);
      toast({
        title: 'Erro ao criar admin',
        description: error.message || 'Tente novamente ou crie manualmente no Supabase.',
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
            <h1 className="text-3xl font-bold">
              Escala Smart
            </h1>
          </div>
          <CardTitle>Criar Usuário Administrador</CardTitle>
          <CardDescription>
            Configure o primeiro usuário administrador do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!success ? (
            <>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-semibold text-sm">Credenciais que serão criadas:</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Login:</span>{' '}
                    <span className="font-mono font-medium">coordenador@guardshift.com</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Senha:</span>{' '}
                    <span className="font-mono font-medium">123456</span>
                  </p>
                </div>
              </div>

              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning mb-1">Importante</p>
                  <p className="text-muted-foreground">
                    Altere a senha após o primeiro login para manter a segurança do sistema.
                  </p>
                </div>
              </div>

              <Button
                onClick={createAdminUser}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando Administrador...
                  </>
                ) : (
                  'Criar Administrador'
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center py-6">
                <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Administrador Criado!</h3>
                <p className="text-muted-foreground text-center">
                  O usuário administrador foi criado com sucesso.
                </p>
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h3 className="font-semibold text-sm">Suas credenciais:</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Login:</span>{' '}
                    <span className="font-mono font-medium">coordenador@guardshift.com</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Senha:</span>{' '}
                    <span className="font-mono font-medium">123456</span>
                  </p>
                </div>
              </div>

              <Button
                onClick={() => (window.location.href = '/login')}
                className="w-full"
              >
                Ir para Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateAdmin;
