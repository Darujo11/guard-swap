import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GuardSwapForm } from '@/components/guards/GuardSwapForm';
import { GuardSwapList } from '@/components/guards/GuardSwapList';
import { TeamScheduleCalendar } from '@/components/schedule/TeamScheduleCalendar';
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
  Eye,
  ChevronLeft,
  ChevronRight,
  Award
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GuardDashboard = () => {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [isSwapFormOpen, setIsSwapFormOpen] = useState(false);
  const [isFullScheduleOpen, setIsFullScheduleOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [extrasMonth, setExtrasMonth] = useState(startOfMonth(new Date()));
  const [extras, setExtras] = useState<any[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [refreshSwapList, setRefreshSwapList] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchExtras();
    }
  }, [currentUser, extrasMonth]);

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

  const fetchExtras = async () => {
    if (!currentUser) return;
    
    setLoadingExtras(true);
    try {
      const monthStart = startOfMonth(extrasMonth);
      const monthEnd = endOfMonth(extrasMonth);

      const { data, error } = await supabase
        .from('extras')
        .select('*')
        .eq('guard_id', currentUser.id)
        .gte('extra_date', monthStart.toISOString().split('T')[0])
        .lte('extra_date', monthEnd.toISOString().split('T')[0])
        .order('extra_date', { ascending: false });

      if (error) throw error;
      setExtras(data || []);
    } catch (error) {
      console.error('[GuardDashboard][FetchExtras]', error);
      toast({
        title: 'Erro ao carregar extras',
        description: 'Não foi possível carregar seus extras.',
        variant: 'destructive',
      });
    } finally {
      setLoadingExtras(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const totalExtras = extras.reduce((sum, extra) => sum + extra.quantity, 0);

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
        teamName: currentUser.team?.name
      }}
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Solicitar Troca de Plantão</DialogTitle>
            </DialogHeader>
            <GuardSwapForm 
              currentUser={currentUser} 
              onClose={() => setIsSwapFormOpen(false)}
              onSwapCreated={() => setRefreshSwapList(prev => prev + 1)}
            />
          </DialogContent>
        </Dialog>
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={() => setIsFullScheduleOpen(true)}
        >
          <Eye className="h-4 w-4" />
          Ver Escala Completa
        </Button>
      </div>

      {/* Full Schedule Dialog */}
      <Dialog open={isFullScheduleOpen} onOpenChange={setIsFullScheduleOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escala Completa de Plantões</DialogTitle>
          </DialogHeader>
          <TeamScheduleCalendar readOnly />
        </DialogContent>
      </Dialog>

      {/* My Extras */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Meus Extras
          </CardTitle>
          <CardDescription>
            Visualize seus extras concedidos por mês
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2 p-4 border rounded-lg bg-background">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExtrasMonth(startOfMonth(subMonths(extrasMonth, 1)))}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center flex-1">
              <p className="text-lg font-semibold capitalize">
                {format(extrasMonth, "MMMM yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExtrasMonth(startOfMonth(addMonths(extrasMonth, 1)))}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Total de Extras no Mês</p>
            <p className="text-3xl font-bold">{totalExtras}</p>
          </div>

          {loadingExtras ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando extras...</p>
            </div>
          ) : extras.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum extra concedido neste mês
            </div>
          ) : (
            <div className="space-y-2">
              {extras.map((extra) => (
                <div key={extra.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{formatDate(extra.extra_date)}</p>
                    <p className="text-sm text-muted-foreground">{extra.justification}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">{extra.quantity} horas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


      <div className="grid gap-6 lg:grid-cols-1">
        {/* Swap Requests */}
        <GuardSwapList key={refreshSwapList} currentUser={currentUser} />
      </div>
    </AppLayout>
  );
};

export default GuardDashboard;