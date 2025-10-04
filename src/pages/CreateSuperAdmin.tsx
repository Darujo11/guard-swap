import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Shield, CheckCircle, Loader2 } from 'lucide-react';

export default function CreateSuperAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const createSuperAdmin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-super-admin-phone', {
        body: {
          phone: '22992242189',
          password: '123456',
          name: 'Super Admin',
          email: '22992242189@guardshift.com'
        }
      });

      if (error) throw error;

      toast({
        title: 'Super Admin criado!',
        description: 'O super admin foi criado com sucesso.',
      });

      setSuccess(true);
    } catch (error: any) {
      console.error('Error creating super admin:', error);
      toast({
        title: 'Erro ao criar super admin',
        description: error.message || 'Ocorreu um erro ao criar o super admin.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl">Criar Super Admin</CardTitle>
            <CardDescription>
              Configure o super administrador do sistema
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!success ? (
            <>
              <div className="space-y-3 rounded-lg bg-muted p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">WhatsApp:</span>
                  <span className="font-medium">22992242189</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Senha:</span>
                  <span className="font-medium">123456</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Permissões:</span>
                  <span className="font-medium text-primary">Acesso Total</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Funcionalidades do Super Admin:</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Visualizar todos os dados do sistema
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Criar e gerenciar planos de assinatura
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Criar e gerenciar administradores
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Gerenciar todas as assinaturas
                  </li>
                </ul>
              </div>

              <Button
                onClick={createSuperAdmin}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando Super Admin...
                  </>
                ) : (
                  'Criar Super Admin'
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Super Admin Criado!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Você pode agora fazer login com as credenciais fornecidas.
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
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
}