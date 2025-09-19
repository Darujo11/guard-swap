import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GuardSwapForm } from '@/components/guards/GuardSwapForm';
import { GuardSwapList } from '@/components/guards/GuardSwapList';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus,
  User,
  ArrowRightLeft,
  Eye
} from 'lucide-react';

const GuardDashboard = () => {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isSwapFormOpen, setIsSwapFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          team:teams(*)
        `)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setCurrentUser(data as Profile);
    } catch (error) {
      console.error('[GuardDashboard][FetchUser]', error);
      toast({
        title: 'Erro de autenticação',
        description: 'Não foi possível carregar seus dados.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <AppLayout title="Meu Painel" user={{ name: 'Carregando...', role: 'GUARD' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!currentUser) {
    return (
      <AppLayout title="Erro" user={{ name: 'Usuário', role: 'GUARD' }}>
        <div className="text-center py-8">
          <p className="text-destructive">Erro ao carregar dados do usuário.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Meu Painel"
      user={{ 
        name: currentUser.name, 
        role: 'GUARD', 
        teamName: currentUser.team?.name || 'Sem equipe'
      }}
      notificationCount={1}
    >
      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <Dialog open={isSwapFormOpen} onOpenChange={setIsSwapFormOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-primary to-primary-hover">
              <Plus className="h-4 w-4" />
              Solicitar Troca de Plantão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Solicitar Troca de Plantão</DialogTitle>
            </DialogHeader>
            <GuardSwapForm 
              currentUser={currentUser} 
              onClose={() => setIsSwapFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
        <Button variant="outline" className="gap-2">
          <Eye className="h-4 w-4" />
          Ver Escala Completa
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Shifts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Meus Próximos Plantões
                </CardTitle>
                <CardDescription>
                  Seus turnos programados - {currentUser.team?.name || 'Sem equipe'}
                </CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  Semana
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                >
                  Mês
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Escala de plantões em desenvolvimento</p>
                <p className="text-sm">Os próximos plantões aparecerão aqui em breve</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Swap Requests */}
        <GuardSwapList currentUser={currentUser} />
      </div>
    </AppLayout>
  );
};

export default GuardDashboard;