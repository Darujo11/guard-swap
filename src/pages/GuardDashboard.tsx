import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { GuardSwapForm } from '@/components/guards/GuardSwapForm';
import { GuardSwapList } from '@/components/guards/GuardSwapList';
import { TeamScheduleCalendar } from '@/components/schedule/TeamScheduleCalendar';
import { GuardPersonalCalendar } from '@/components/schedule/GuardPersonalCalendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Award,
  FileText,
  BarChart3,
  Scale
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
  const [rankingAllMonths, setRankingAllMonths] = useState<boolean>(true);
  const [rankingPercentageFilter, setRankingPercentageFilter] = useState<'all' | '50' | '100'>('all');
  const [rankingMonth, setRankingMonth] = useState(startOfMonth(new Date()));
  
  // Estados independentes para Registros Detalhados
  const [detailedAllMonths, setDetailedAllMonths] = useState<boolean>(true);
  const [detailedPercentageFilter, setDetailedPercentageFilter] = useState<'all' | '50' | '100'>('all');
  const [detailedMonth, setDetailedMonth] = useState(startOfMonth(new Date()));
  const [detailedExtras, setDetailedExtras] = useState<OrgExtra[]>([]);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  
  // Estados para ordenação da tabela detalhada
  const [sortColumn, setSortColumn] = useState<'extra_date' | 'guardName' | 'quantity' | 'percentage_type' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Estado para expansão do ranking
  const [expandedGuards, setExpandedGuards] = useState<Set<string>>(new Set());
  
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchExtras();
    }
  }, [currentUser, extrasMonth]);

  useEffect(() => {
    if (currentUser) {
      fetchOrganizationExtras();
    }
  }, [currentUser, rankingMonth, rankingAllMonths]);

  useEffect(() => {
    if (currentUser) {
      fetchDetailedExtras();
    }
  }, [currentUser, detailedMonth, detailedAllMonths]);

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
        .gte('extra_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('extra_date', format(monthEnd, 'yyyy-MM-dd'))
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
      // Buscar todos os guards da organização
      const { data: guardsData, error: guardsError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('admin_id', currentUser.admin_id)
        .not('user_id', 'is', null)
        .order('name');

      if (guardsError) throw guardsError;
      setGuards(guardsData || []);

      // Buscar extras baseado no filtro de período
      let query = supabase
        .from('extras')
        .select('id, guard_id, quantity, percentage_type, extra_date, justification')
        .eq('admin_id', currentUser.admin_id)
        .order('extra_date', { ascending: false });

      if (!rankingAllMonths) {
        const monthStart = startOfMonth(rankingMonth);
        const monthEnd = endOfMonth(rankingMonth);
        query = query
          .gte('extra_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('extra_date', format(monthEnd, 'yyyy-MM-dd'));
      }

      const { data: extrasData, error: extrasError } = await query;

      if (extrasError) throw extrasError;
      setAllGuardsExtras((extrasData || []) as OrgExtra[]);
    } catch (error) {
      console.error('[GuardDashboard][FetchOrganizationExtras]', error);
    } finally {
      setLoadingRanking(false);
    }
  };

  const fetchDetailedExtras = async () => {
    if (!currentUser?.admin_id) return;
    
    setLoadingDetailed(true);
    try {
      let query = supabase
        .from('extras')
        .select('id, guard_id, quantity, percentage_type, extra_date, justification')
        .eq('admin_id', currentUser.admin_id)
      .order('extra_date', { ascending: true });

      if (!detailedAllMonths) {
        const monthStart = startOfMonth(detailedMonth);
        const monthEnd = endOfMonth(detailedMonth);
        query = query
          .gte('extra_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('extra_date', format(monthEnd, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;

      if (error) throw error;
      setDetailedExtras((data || []) as OrgExtra[]);
    } catch (error) {
      console.error('[GuardDashboard][FetchDetailedExtras]', error);
    } finally {
      setLoadingDetailed(false);
    }
  };

  // Ranking filtrado por tipo de porcentagem
  const rankingFiltered = useMemo(() => {
    let filteredExtras = allGuardsExtras;
    
    // Filtrar por tipo se não for "all"
    if (rankingPercentageFilter !== 'all') {
      filteredExtras = filteredExtras.filter(e => e.percentage_type === parseInt(rankingPercentageFilter));
    }
    
    return guards
      .map(guard => ({
        ...guard,
        total: filteredExtras
          .filter(e => e.guard_id === guard.id)
          .reduce((sum, e) => sum + e.quantity, 0)
      }))
      .filter(g => g.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [guards, allGuardsExtras, rankingPercentageFilter]);

  // Registros detalhados de todos os guards com nome (para ranking)
  const allExtrasWithNames = useMemo(() => {
    return allGuardsExtras.map(extra => {
      const guard = guards.find(g => g.id === extra.guard_id);
      return {
        ...extra,
        guardName: guard?.name || 'Desconhecido'
      };
    });
  }, [allGuardsExtras, guards]);

  // Função para alternar ordenação
  const handleSort = (column: 'extra_date' | 'guardName' | 'quantity' | 'percentage_type') => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Função para alternar expansão do ranking
  const toggleGuardExpanded = (guardId: string) => {
    setExpandedGuards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(guardId)) {
        newSet.delete(guardId);
      } else {
        newSet.add(guardId);
      }
      return newSet;
    });
  };

  // Função para obter detalhes dos extras do segurança no ranking
  const getGuardExtrasDetails = (guardId: string) => {
    let baseExtras = allGuardsExtras.filter(e => e.guard_id === guardId);
    
    // Aplicar filtro de período (usa os mesmos filtros do ranking)
    if (!rankingAllMonths) {
      const startDate = startOfMonth(rankingMonth);
      const endDate = endOfMonth(rankingMonth);
      baseExtras = baseExtras.filter((extra) => {
        const extraDate = new Date(`${extra.extra_date}T00:00:00`);
        return extraDate >= startDate && extraDate <= endDate;
      });
    }
    
    // Aplicar filtro de porcentagem
    if (rankingPercentageFilter !== 'all') {
      baseExtras = baseExtras.filter(e => e.percentage_type === parseInt(rankingPercentageFilter));
    }
    
    // Ordenar por data
    return baseExtras.sort((a, b) => {
      const dateA = new Date(`${a.extra_date}T00:00:00`);
      const dateB = new Date(`${b.extra_date}T00:00:00`);
      return dateA.getTime() - dateB.getTime();
    });
  };

  // Registros detalhados filtrados independentemente
  const detailedExtrasFiltered = useMemo(() => {
    let filtered = detailedExtras;
    
    // Filtrar por tipo se não for "all"
    if (detailedPercentageFilter !== 'all') {
      filtered = filtered.filter(e => e.percentage_type === parseInt(detailedPercentageFilter));
    }
    
    let result = filtered.map(extra => {
      const guard = guards.find(g => g.id === extra.guard_id);
      return {
        ...extra,
        guardName: guard?.name || 'Desconhecido'
      };
    });

    // Aplicar ordenação
    if (sortColumn) {
      result = [...result].sort((a, b) => {
        let comparison = 0;
        
        if (sortColumn === 'guardName') {
          comparison = a.guardName.localeCompare(b.guardName, 'pt-BR');
        } else if (sortColumn === 'extra_date') {
          comparison = new Date(a.extra_date).getTime() - new Date(b.extra_date).getTime();
        } else if (sortColumn === 'quantity' || sortColumn === 'percentage_type') {
          comparison = a[sortColumn] - b[sortColumn];
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [detailedExtras, guards, detailedPercentageFilter, sortColumn, sortDirection]);

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

      {/* Calendário Pessoal */}
      {currentUser.team_id && (
        <GuardPersonalCalendar
          guardId={currentUser.id}
          teamId={currentUser.team_id}
          teamColor={currentUser.team?.color || '#3b82f6'}
          teamName={currentUser.team?.name || 'Minha Equipe'}
        />
      )}

      {/* Ranking de Extras Unificado com Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Ranking de Extras
          </CardTitle>
          <CardDescription>
            Ranking de extras na organização
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros do Ranking */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Período</Label>
              <Select 
                value={rankingAllMonths ? "all" : "specific"} 
                onValueChange={(value) => setRankingAllMonths(value === "all")}
              >
                <SelectTrigger className="h-[50px]">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specific">Mês Específico</SelectItem>
                  <SelectItem value="all">Todos os Meses (Acumulado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!rankingAllMonths && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mês</Label>
                <div className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-background h-[50px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRankingMonth(subMonths(rankingMonth, 1))}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center flex-1">
                    <p className="text-sm font-semibold capitalize">
                      {format(rankingMonth, "MMMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRankingMonth(addMonths(rankingMonth, 1))}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de Extra</Label>
              <Select 
                value={rankingPercentageFilter} 
                onValueChange={(value: 'all' | '50' | '100') => setRankingPercentageFilter(value)}
              >
                <SelectTrigger className="h-[50px]">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="50">Apenas 50%</SelectItem>
                  <SelectItem value="100">Apenas 100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingRanking ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando ranking...</p>
            </div>
          ) : rankingFiltered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado disponível para os filtros selecionados
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
                  {(() => {
                    // Obter valores únicos de total, ordenados decrescente
                    const uniqueTotals = [...new Set(rankingFiltered.map(g => g.total))].sort((a, b) => b - a);
                    return rankingFiltered.map((guard) => {
                    const isCurrentUser = guard.id === currentUser?.id;
                    // Calcular posição baseada em valores únicos
                    const position = uniqueTotals.indexOf(guard.total) + 1;
                    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                    const isExpanded = expandedGuards.has(guard.id);
                    const guardExtras = getGuardExtrasDetails(guard.id);
                    
                    return (
                      <Collapsible key={guard.id} open={isExpanded} onOpenChange={() => toggleGuardExpanded(guard.id)} asChild>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow 
                              className={`cursor-pointer hover:bg-muted/50 ${isCurrentUser ? 'bg-accent/50 font-medium' : ''}`}
                            >
                              <TableCell>
                                <span className="flex items-center gap-2">
                                  {medal && <span className="text-xl">{medal}</span>}
                                  #{position}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  {guard.name}
                                  {isCurrentUser && (
                                    <span className="ml-2 text-xs text-primary">(Você)</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {guard.total}h
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableCell colSpan={3} className="p-0">
                                <div className="p-4 border-t">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Data</TableHead>
                                        <TableHead className="text-xs">Horas</TableHead>
                                        <TableHead className="text-xs">Tipo</TableHead>
                                        <TableHead className="text-xs">Fundamentação</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {guardExtras.map((extra) => (
                                        <TableRow key={extra.id}>
                                          <TableCell className="text-sm">{formatDate(extra.extra_date)}</TableCell>
                                          <TableCell className="text-sm font-semibold">{extra.quantity}h</TableCell>
                                          <TableCell>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${extra.percentage_type === 50 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                                              {extra.percentage_type}%
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-sm max-w-xs truncate">{extra.justification}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })})()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

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
          {/* Filtros independentes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Período</Label>
              <Select 
                value={detailedAllMonths ? "all" : "specific"} 
                onValueChange={(value) => setDetailedAllMonths(value === "all")}
              >
                <SelectTrigger className="h-[50px]">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specific">Mês Específico</SelectItem>
                  <SelectItem value="all">Todos os Meses (Acumulado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!detailedAllMonths && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mês</Label>
                <div className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-background h-[50px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDetailedMonth(subMonths(detailedMonth, 1))}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center flex-1">
                    <p className="text-sm font-semibold capitalize">
                      {format(detailedMonth, "MMMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDetailedMonth(addMonths(detailedMonth, 1))}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de Extra</Label>
              <Select 
                value={detailedPercentageFilter} 
                onValueChange={(value: 'all' | '50' | '100') => setDetailedPercentageFilter(value)}
              >
                <SelectTrigger className="h-[50px]">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="50">Apenas 50%</SelectItem>
                  <SelectItem value="100">Apenas 100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingDetailed ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando registros...</p>
            </div>
          ) : detailedExtrasFiltered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro de extra para os filtros selecionados
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('extra_date')}
                    >
                      <div className="flex items-center gap-1">
                        Data
                        {sortColumn === 'extra_date' ? (
                          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('guardName')}
                    >
                      <div className="flex items-center gap-1">
                        Segurança
                        {sortColumn === 'guardName' ? (
                          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('quantity')}
                    >
                      <div className="flex items-center gap-1">
                        Horas
                        {sortColumn === 'quantity' ? (
                          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort('percentage_type')}
                    >
                      <div className="flex items-center gap-1">
                        Tipo
                        {sortColumn === 'percentage_type' ? (
                          sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Fundamentação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedExtrasFiltered.map((extra) => {
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
