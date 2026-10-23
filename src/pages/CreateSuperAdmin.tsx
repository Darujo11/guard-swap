import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Shield, CheckCircle, Loader2 } from 'lucide-react';

export default function CreateSuperAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    phone: '',
    password: '',
    name: '',
    email: ''
  });

  const handleSubmit = async () => {
    if (!form.phone || !form.password || !form.name) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-super-admin-phone', {
        body: {
          phone: form.phone,
          password: form.password,
          name: form.name,
          email: form.email || undefined,
          mode: 'upsert'
        }
      });

      if (error) throw error;

      toast({
        title: 'Super Admin salvo!',
        description: 'O super admin foi criado/atualizado com sucesso.',
      });

      setSuccess(true);
    } catch (error: any) {
      console.error('Error saving super admin:', error);
      toast({
        title: 'Erro ao salvar super admin',
        description: error.message || 'Ocorreu um erro.',
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
            <CardTitle className="text-2xl">Super Admin</CardTitle>
            <CardDescription>
              Criar ou atualizar o super administrador do sistema
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!success ? (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="sa-name">Nome *</Label>
                  <Input
                    id="sa-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nome do super admin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sa-phone">WhatsApp *</Label>
                  <Input
                    id="sa-phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="Ex: 22999999999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sa-email">Email (opcional)</Label>
                  <Input
                    id="sa-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se vazio, será gerado automaticamente a partir do WhatsApp.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sa-password">Senha *</Label>
                  <PasswordInput
                    id="sa-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Senha do super admin"
                  />
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Criar / Atualizar Super Admin'
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <h3 className="font-semibold">Super Admin Salvo!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Você pode agora fazer login com as credenciais fornecidas.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSuccess(false)}
                  className="flex-1"
                >
                  Editar Novamente
                </Button>
                <Button
                  onClick={() => navigate('/login')}
                  className="flex-1"
                >
                  Ir para Login
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
