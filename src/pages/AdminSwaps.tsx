import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SwapRequest, Profile } from '@/lib/types';
import { SWAP_STATUS_CONFIG } from '@/lib/constants';
import { 
  Calendar,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  FileDown,
  Clock,
  Users,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdminSwaps = () => {
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<SwapRequest | null>(null);
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'approve' | 'reject' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchSwapRequests();
  }, []);

  const fetchSwapRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('swap_requests')
        .select(`
          *,
          requester:profiles!swap_requests_requester_id_fkey(
            *,
            team:teams(*)
          ),
          target:profiles!swap_requests_target_id_fkey(
            *,
            team:teams(*)
          ),
          admin_approver:profiles!swap_requests_admin_approved_by_fkey(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSwapRequests((data || []) as SwapRequest[]);
    } catch (error) {
      console.error('[AdminSwaps][FetchData]', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as solicitações de troca.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async () => {
    if (!selectedRequest || !decisionAction) return;

    try {
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!adminProfile) throw new Error('Perfil do admin não encontrado');

      const updateData = {
        status: decisionAction === 'approve' ? 'APPROVED' : 'REJECTED',
        admin_approved: decisionAction === 'approve',
        admin_approved_by: adminProfile.id,
        admin_approved_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('swap_requests')
        .update(updateData)
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Create audit log
      await supabase.from('audit_logs').insert({
        user_id: adminProfile.id,
        action: decisionAction === 'approve' ? 'SWAP_APPROVED' : 'SWAP_REJECTED',
        entity_type: 'swap_request',
        entity_id: selectedRequest.id,
        details: {
          reason: decisionReason,
          requester_id: selectedRequest.requester_id,
          target_id: selectedRequest.target_id
        }
      });

      toast({
        title: `Solicitação ${decisionAction === 'approve' ? 'aprovada' : 'rejeitada'}`,
        description: `A solicitação de troca foi ${decisionAction === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso.`,
      });

      await fetchSwapRequests();
      setIsDecisionDialogOpen(false);
      setDecisionReason('');
      setSelectedRequest(null);
    } catch (error) {
      console.error('[AdminSwaps][HandleDecision]', error);
      toast({
        title: 'Erro ao processar',
        description: 'Não foi possível processar a decisão.',
        variant: 'destructive',
      });
    }
  };

  const openDecisionDialog = (request: SwapRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setDecisionAction(action);
    setIsDecisionDialogOpen(true);
  };

  const generatePDF = async (request: SwapRequest) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const statusEmoji = {
        'PENDING': '⏳',
        'ACCEPTED': '✅',
        'APPROVED': '✅',
        'REJECTED': '❌',
        'CANCELLED': '🚫'
      }[request.status] || '📋';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Solicitação de Troca - ${request.id}</title>
            <meta charset="UTF-8">
            <style>
              body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 40px;
                color: #333;
                line-height: 1.6;
              }
              .header { 
                border-bottom: 3px solid #2563eb;
                padding-bottom: 20px;
                margin-bottom: 30px;
              }
              .header h1 {
                margin: 0 0 10px 0;
                color: #1e40af;
                font-size: 24px;
              }
              .protocol {
                color: #6b7280;
                font-size: 14px;
              }
              .section { 
                margin-bottom: 25px;
                padding: 15px;
                border-left: 4px solid #e5e7eb;
                background: #f9fafb;
              }
              .section h3 {
                margin: 0 0 15px 0;
                color: #1f2937;
                font-size: 16px;
              }
              .info-row {
                margin: 8px 0;
                font-size: 14px;
              }
              .label { 
                font-weight: 600;
                color: #4b5563;
              }
              .value {
                color: #1f2937;
              }
              .dates {
                font-size: 18px;
                font-weight: 600;
                color: #2563eb;
                text-align: center;
                padding: 10px;
                background: #eff6ff;
                border-radius: 6px;
                margin: 15px 0;
              }
              .status-badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 6px;
                font-weight: 600;
                font-size: 14px;
              }
              .status-pending { background: #fef3c7; color: #d97706; }
              .status-accepted { background: #dcfce7; color: #16a34a; }
              .status-approved { background: #dcfce7; color: #16a34a; }
              .status-rejected { background: #fecaca; color: #dc2626; }
              .status-cancelled { background: #f3f4f6; color: #6b7280; }
              .reason-box {
                background: white;
                padding: 15px;
                border-radius: 6px;
                border: 1px solid #e5e7eb;
                font-style: italic;
                color: #4b5563;
              }
              .footer { 
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 12px;
              }
              .confirmation {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: 600;
                font-size: 13px;
              }
              .confirmation-yes { background: #dcfce7; color: #16a34a; }
              .confirmation-no { background: #fef3c7; color: #d97706; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📄 Solicitação de Troca de Plantão</h1>
              <p class="protocol"><strong>Protocolo:</strong> ${request.id}</p>
            </div>
            
            <div class="section">
              <h3>📅 Informações da Solicitação</h3>
              <div class="dates">
                ${format(new Date(request.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })} → ${format(new Date(request.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
              <div class="info-row">
                <span class="label">Status:</span> 
                <span class="status-badge status-${request.status.toLowerCase()}">
                  ${statusEmoji} ${SWAP_STATUS_CONFIG[request.status as keyof typeof SWAP_STATUS_CONFIG]?.label}
                </span>
              </div>
              <div class="info-row">
                <span class="label">Data da Solicitação:</span> 
                <span class="value">${format(new Date(request.created_at), 'dd/MM/yyyy', { locale: ptBR })} às ${format(new Date(request.created_at), 'HH:mm', { locale: ptBR })}</span>
              </div>
            </div>

            <div class="section">
              <h3>👤 Solicitante</h3>
              <div class="info-row">
                <span class="label">Nome:</span> 
                <span class="value">${request.requester?.name}</span>
              </div>
              <div class="info-row">
                <span class="label">E-mail:</span> 
                <span class="value">${request.requester?.email}</span>
              </div>
              <div class="info-row">
                <span class="label">Equipe:</span> 
                <span class="value">${request.requester?.team?.name}</span>
              </div>
            </div>

            <div class="section">
              <h3>👥 Troca Solicitada com</h3>
              <div class="info-row">
                <span class="label">Nome:</span> 
                <span class="value">${request.target?.name}</span>
              </div>
              <div class="info-row">
                <span class="label">E-mail:</span> 
                <span class="value">${request.target?.email}</span>
              </div>
              <div class="info-row">
                <span class="label">Equipe:</span> 
                <span class="value">${request.target?.team?.name}</span>
              </div>
              <div class="info-row">
                <span class="label">Confirmação de Ciência:</span> 
                <span class="confirmation ${request.target_confirmation ? 'confirmation-yes' : 'confirmation-no'}">
                  ${request.target_confirmation ? 'Confirmada ✅' : 'Pendente ⏳'}
                </span>
              </div>
            </div>

            <div class="section">
              <h3>📝 Motivo da Troca</h3>
              <div class="reason-box">
                ${request.reason}
              </div>
              <div class="info-row" style="margin-top: 10px; font-size: 12px; color: #6b7280;">
                Solicitação registrada em ${format(new Date(request.created_at), 'dd/MM/yyyy', { locale: ptBR })} às ${format(new Date(request.created_at), 'HH:mm', { locale: ptBR })}
                (Protocolo: ${request.id})
              </div>
            </div>

            ${request.admin_approved_at ? `
              <div class="section">
                <h3>⚖️ Decisão Administrativa</h3>
                <div class="info-row">
                  <span class="label">Decidido em:</span> 
                  <span class="value">${format(new Date(request.admin_approved_at), 'dd/MM/yyyy', { locale: ptBR })} às ${format(new Date(request.admin_approved_at), 'HH:mm', { locale: ptBR })}</span>
                </div>
                <div class="info-row">
                  <span class="label">Decidido por:</span> 
                  <span class="value">${request.admin_approver?.name || 'Coordenador'}</span>
                </div>
              </div>
            ` : ''}

            <div class="footer">
              <p>📄 Documento gerado em ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })} às ${format(new Date(), 'HH:mm', { locale: ptBR })}</p>
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('[AdminSwaps][GeneratePDF]', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar o PDF da solicitação.',
        variant: 'destructive',
      });
    }
  };

  const filteredRequests = swapRequests.filter(request => {
    const matchesSearch = 
      request.requester?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.target?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.reason.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStats = () => {
    return {
      pending: swapRequests.filter(r => r.status === 'PENDING').length,
      needConfirmation: swapRequests.filter(r => r.status === 'ACCEPTED' && !r.target_confirmation).length,
      approved: swapRequests.filter(r => r.status === 'APPROVED').length,
      rejected: swapRequests.filter(r => r.status === 'REJECTED').length,
    };
  };

  const stats = getStats();

  // Agrupar solicitações por mês
  const groupedByMonth = filteredRequests.reduce((acc, request) => {
    const monthKey = format(startOfMonth(new Date(request.created_at)), 'yyyy-MM');
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(request);
    return acc;
  }, {} as Record<string, SwapRequest[]>);

  // Ordenar as chaves dos meses (mais recente primeiro)
  const sortedMonthKeys = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

  if (loading) {
    return (
      <AppLayout title="Gerenciar Trocas" user={{ name: 'Admin Sistema', role: 'ADMIN' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando solicitações...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Gerenciar Trocas" user={{ name: 'Admin Sistema', role: 'ADMIN' }}>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Ciência</CardTitle>
            <AlertCircle className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{stats.needConfirmation}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
            <XCircle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="ACCEPTED">Aceita</SelectItem>
            <SelectItem value="APPROVED">Aprovada</SelectItem>
            <SelectItem value="REJECTED">Rejeitada</SelectItem>
            <SelectItem value="CANCELLED">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Swap Requests List */}
      <div className="space-y-6">
        {sortedMonthKeys.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle className="mb-2">Nenhuma solicitação encontrada</CardTitle>
              <CardDescription>
                {searchTerm || statusFilter !== 'all'
                  ? 'Nenhuma solicitação corresponde aos critérios de busca.'
                  : 'Não há solicitações de troca no momento.'}
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          sortedMonthKeys.map((monthKey) => {
            const monthRequests = groupedByMonth[monthKey];
            const monthDate = new Date(monthKey + '-01');
            const monthLabel = format(monthDate, 'MMMM yyyy', { locale: ptBR });
            
            return (
              <div key={monthKey} className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b-2 border-primary/20">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold capitalize">{monthLabel}</h2>
                  <Badge variant="secondary" className="ml-auto">
                    {monthRequests.length} {monthRequests.length === 1 ? 'solicitação' : 'solicitações'}
                  </Badge>
                </div>
                
                <div className="space-y-4">
                  {monthRequests.map((request) => (
                    <Card key={request.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="secondary" className="font-mono text-xs">
                                Protocolo: {request.id.slice(0, 8)}
                              </Badge>
                              <StatusBadge status={request.status} />
                              {!request.target_confirmation && request.status !== 'PENDING' && (
                                <Badge variant="outline" className="text-warning border-warning">
                                  Aguardando Ciência
                                </Badge>
                              )}
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <div className="text-sm text-muted-foreground">Solicitante</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{request.requester?.name}</span>
                                  {request.requester?.team && (
                                    <TeamBadge team={request.requester.team} />
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground">Membro Convidado</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{request.target?.name}</span>
                                  {request.target?.team && (
                                    <TeamBadge team={request.target.team} />
                                  )}
                                </div>
                              </div>
                            </div>

                            <div>
                              <div className="text-sm text-muted-foreground">Datas da Troca</div>
                              <div className="font-medium text-sm">
                                {format(new Date(request.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                                {' → '}
                                {format(new Date(request.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Plantão do solicitante → Plantão desejado
                              </div>
                            </div>

                            <div>
                              <div className="text-sm text-muted-foreground">Motivo</div>
                              <div className="text-sm">{request.reason}</div>
                            </div>

                            <div className="text-xs text-muted-foreground">
                              Solicitado em {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 lg:w-auto w-full">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generatePDF(request)}
                              className="gap-2"
                            >
                              <FileDown className="h-4 w-4" />
                              PDF
                            </Button>
                            
                            {request.status === 'ACCEPTED' && request.target_confirmation && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => openDecisionDialog(request, 'approve')}
                                  className="gap-2 bg-success hover:bg-success/90 text-success-foreground"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Aprovar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDecisionDialog(request, 'reject')}
                                  className="gap-2 text-danger hover:bg-danger hover:text-danger-foreground"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Rejeitar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Decision Dialog */}
      <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionAction === 'approve' ? 'Aprovar' : 'Rejeitar'} Solicitação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Troca entre</div>
              <div className="font-medium">
                {selectedRequest?.requester?.name} ↔ {selectedRequest?.target?.name}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Datas: {selectedRequest && (
                  <>
                    {format(new Date(selectedRequest.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                    {' → '}
                    {format(new Date(selectedRequest.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="reason">
                {decisionAction === 'approve' ? 'Observações (opcional)' : 'Motivo da rejeição'}
              </Label>
              <Textarea
                id="reason"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder={
                  decisionAction === 'approve'
                    ? 'Observações sobre a aprovação...'
                    : 'Explique o motivo da rejeição...'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDecisionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDecision}
              className={decisionAction === 'approve' ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'}
            >
              {decisionAction === 'approve' ? 'Aprovar' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminSwaps;