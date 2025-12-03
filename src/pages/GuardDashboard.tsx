import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  Award,
  FileText,
  BarChart3
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface OrgExtra {
  id: string;
  guard_id: string;
  quantity: number;
  percentage_type: number;
  extra_date: string;
  justification: string;
}

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
  const [allGuardsExtras, setAllGuardsExtras] = useState<OrgExtra[]>([]);
  const [guards, setGuards] = useState<any[]>([]);
  const [loadingRanking, setLoadingRanking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchExtras();
      fetchOrganizationExtras();
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

  const fetchOrganizationExtras = async () => {
    if (!currentUser?.admin_id) return;
    
    setLoadingRanking(true);
    try {
      const monthStart = startOfMonth(extrasMonth);
      const monthEnd = endOfMonth(extrasMonth);

      // Buscar todos os guards da organização
      const { data: guardsData, error: guardsError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('admin_id', currentUser.admin_id)
        .not('user_id', 'is', null)
        .order('name');

      if (guardsError) throw guardsError;
      setGuards(guardsData || []);

      // Buscar todos os extras da organização no mês (incluindo percentage_type para transparência)
      const { data: extrasData, error: extrasError } = await supabase
        .from('extras')
        .select('id, guard_id, quantity, percentage_type, extra_date, justification')
        .eq('admin_id', currentUser.admin_id)
        .gte('extra_date', monthStart.toISOString().split('T')[0])
        .lte('extra_date', monthEnd.toISOString().split('T')[0])
        .order('extra_date', { ascending: false });

      if (extrasError) throw extrasError;
      setAllGuardsExtras((extrasData || []) as OrgExtra[]);
    } catch (error) {
      console.error('[GuardDashboard][FetchOrganizationExtras]', error);
    } finally {
      setLoadingRanking(false);
    }
  };

  // Rankings separados por tipo de porcentagem
  const ranking50 = useMemo(() => {
    const extras50 = allGuardsExtras.filter(e => e.percentage_type === 50);
    return guards
      .map(guard => ({
        ...guard,
        total: extras50
          .filter(e => e.guard_id === guard.id)
          .reduce((sum, e) => sum + e.quantity, 0)
      }))
      .sort((a, b) => b.total - a.total);
  }, [guards, allGuardsExtras]);

  const ranking100 = useMemo(() => {
    const extras100 = allGuardsExtras.filter(e => e.percentage_type === 100);
    return guards
      .map(guard => ({
        ...guard,
        total: extras100
          .filter(e => e.guard_id === guard.id)
          .reduce((sum, e) => sum + e.quantity, 0)
      }))
      .sort((a, b) => b.total - a.total);
  }, [guards, allGuardsExtras]);

  // Registros detalhados de todos os guards com nome
  const allExtrasWithNames = useMemo(() => {
    return allGuardsExtras.map(extra => {
      const guard = guards.find(g => g.id === extra.guard_id);
      return {
        ...extra,
        guardName: guard?.name || 'Desconhecido'
      };
    });
  }, [allGuardsExtras, guards]);

  const generateMyExtrasPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Meu Relatório de Extras', 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Período: ${format(extrasMonth, "MMMM yyyy", { locale: ptBR })}`, 14, 30);
    doc.text(`Segurança: ${currentUser?.name || ''}`, 14, 37);
    
    const tableData = extras.map(extra => [
      formatDate(extra.extra_date),
      `${extra.quantity}h`,
      `${extra.percentage_type}%`,
      extra.justification
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Data', 'Horas', 'Tipo', 'Fundamentação']],
      body: tableData,
      foot: [[{ content: `Total: ${totalExtras} horas`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }]],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`meus-extras-${format(extrasMonth, "yyyy-MM")}.pdf`);
    
    toast({
      title: 'PDF gerado',
      description: 'Seu relatório mensal foi gerado com sucesso.',
    });
  };

  const generateCompleteExtrasPDF = async () => {
    try {
      // Buscar todos os extras do usuário
      const { data: allExtras, error } = await supabase
        .from('extras')
        .select('*')
        .eq('guard_id', currentUser?.id)
        .order('extra_date', { ascending: false });

      if (error) throw error;

      if (!allExtras || allExtras.length === 0) {
        toast({
          title: 'Sem dados',
          description: 'Você não possui extras registrados.',
          variant: 'destructive',
        });
        return;
      }

      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.text('Relatório Completo de Extras', 14, 20);
      
      doc.setFontSize(12);
      doc.text(`Segurança: ${currentUser?.name || ''}`, 14, 30);
      doc.text(`Data de geração: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}`, 14, 37);
      
      const tableData = allExtras.map(extra => [
        formatDate(extra.extra_date),
        `${extra.quantity}h`,
        `${extra.percentage_type}%`,
        extra.justification
      ]);

      const totalCompleteExtras = allExtras.reduce((sum, extra) => sum + extra.quantity, 0);

      autoTable(doc, {
        startY: 45,
        head: [['Data', 'Horas', 'Tipo', 'Fundamentação']],
        body: tableData,
        foot: [[{ content: `Total Geral: ${totalCompleteExtras} horas`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }]],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(`meus-extras-completo-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      
      toast({
        title: 'PDF gerado',
        description: 'Seu relatório completo foi gerado com sucesso.',
      });
    } catch (error) {
      console.error('[GuardDashboard][GenerateCompletePDF]', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar o relatório completo.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const totalExtras = extras.reduce((sum, extra) => sum + extra.quantity, 0);

  const RankingTable = ({ 
    data, 
    title, 
    percentageType,
    currentMonth,
    onPreviousMonth,
    onNextMonth
  }: { 
    data: any[], 
    title: string, 
    percentageType: number,
    currentMonth: Date,
    onPreviousMonth: () => void,
    onNextMonth: () => void
  }) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>
          Ranking de extras a {percentageType}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Navegação por mês */}
        <div className="flex items-center justify-between gap-2 p-4 border rounded-lg bg-background mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPreviousMonth}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center flex-1">
            <p className="text-lg font-semibold capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNextMonth}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loadingRanking ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando ranking...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum dado disponível para ranking
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Posição</TableHead>
                  <TableHead>Segurança</TableHead>
                  <TableHead className="text-right">Total de Extras</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((guard, index) => {
                  const isCurrentUser = guard.id === currentUser?.id;
                  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                  
                  return (
                    <TableRow 
                      key={guard.id}
                      className={isCurrentUser ? 'bg-accent/50 font-medium' : ''}
                    >
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {medal && <span className="text-xl">{medal}</span>}
                          #{index + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        {guard.name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-primary">(Você)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {guard.total}h
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <AppLayout title="Seguranças Unidos" user={{ name: 'Carregando...', role: 'GUARD' }}>
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
      title="Seguranças Unidos"
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
              <DialogDescription>
                Preencha os dados para solicitar uma troca com outro membro da equipe
              </DialogDescription>
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
            <DialogDescription>
              Visualize a escala completa de todos os plantões programados
            </DialogDescription>
          </DialogHeader>
          <TeamScheduleCalendar readOnly />
        </DialogContent>
      </Dialog>

      {/* Swap Requests */}
      <div className="mb-6">
        <GuardSwapList key={refreshSwapList} currentUser={currentUser} />
      </div>

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
                    <span className={`text-xs px-2 py-0.5 rounded ${extra.percentage_type === 50 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                      {extra.percentage_type}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relatório Mensal */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório Mensal
          </CardTitle>
          <CardDescription>
            Gere um PDF com seus extras
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Navegação por mês */}
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

          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={generateMyExtrasPDF}
              disabled={extras.length === 0}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Gerar PDF do Mês
            </Button>
            <Button 
              onClick={generateCompleteExtrasPDF}
              variant="outline"
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Gerar PDF Completo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ranking de Extras - 50% */}
      <RankingTable 
        data={ranking50} 
        title="Resumo Mensal - Ranking de Extras a 50%" 
        percentageType={50}
        currentMonth={extrasMonth}
        onPreviousMonth={() => setExtrasMonth(startOfMonth(subMonths(extrasMonth, 1)))}
        onNextMonth={() => setExtrasMonth(startOfMonth(addMonths(extrasMonth, 1)))}
      />

      {/* Ranking de Extras - 100% */}
      <RankingTable 
        data={ranking100} 
        title="Resumo Mensal - Ranking de Extras a 100%" 
        percentageType={100}
        currentMonth={extrasMonth}
        onPreviousMonth={() => setExtrasMonth(startOfMonth(subMonths(extrasMonth, 1)))}
        onNextMonth={() => setExtrasMonth(startOfMonth(addMonths(extrasMonth, 1)))}
      
      />

      {/* Registros Detalhados de Extras - Todos os Seguranças */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Registros Detalhados de Extras
          </CardTitle>
          <CardDescription>
            Todos os extras da organização
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Navegação por mês */}
          <div className="flex items-center justify-between gap-2 p-4 border rounded-lg bg-background mb-4">
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

          {loadingRanking ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando registros...</p>
            </div>
          ) : allExtrasWithNames.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro de extra neste mês
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Segurança</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fundamentação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allExtrasWithNames.map((extra) => {
                    const isCurrentUser = extra.guard_id === currentUser?.id;
                    return (
                      <TableRow 
                        key={extra.id}
                        className={isCurrentUser ? 'bg-accent/50' : ''}
                      >
                        <TableCell className="font-medium">
                          {formatDate(extra.extra_date)}
                        </TableCell>
                        <TableCell>
                          {extra.guardName}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-primary">(Você)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold">{extra.quantity}h</span>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${extra.percentage_type === 50 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                            {extra.percentage_type}%
                          </span>
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {extra.justification}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default GuardDashboard;
