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
import { format } from 'date-fns';
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
      // Simple PDF generation using HTML to PDF
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Solicitação de Troca - ${request.id}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .header { text-align: center; margin-bottom: 40px; }
              .section { margin-bottom: 30px; }
              .label { font-weight: bold; }
              .status { padding: 8px 16px; border-radius: 4px; display: inline-block; }
              .status.pending { background: #fef3c7; color: #d97706; }
              .status.accepted { background: #dcfce7; color: #16a34a; }
              .status.approved { background: #dcfce7; color: #16a34a; }
              .status.rejected { background: #fecaca; color: #dc2626; }
              .footer { margin-top: 40px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>SOLICITAÇÃO DE TROCA DE PLANTÃO</h1>
              <p>Protocolo: ${request.id}</p>
            </div>
            
            <div class="section">
              <h3>Informações da Solicitação</h3>
              <p><span class="label">Data da Troca:</span> ${format(new Date(request.swap_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
              <p><span class="label">Status:</span> <span class="status ${request.status.toLowerCase()}">${SWAP_STATUS_CONFIG[request.status as keyof typeof SWAP_STATUS_CONFIG]?.label}</span></p>
              <p><span class="label">Data da Solicitação:</span> ${format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
            </div>

            <div class="section">
              <h3>Solicitante</h3>
              <p><span class="label">Nome:</span> ${request.requester?.name}</p>
              <p><span class="label">Email:</span> ${request.requester?.email}</p>
              <p><span class="label">Equipe:</span> ${request.requester?.team?.name}</p>
            </div>

            <div class="section">
              <h3>Membro Convidado</h3>
              <p><span class="label">Nome:</span> ${request.target?.name}</p>
              <p><span class="label">Email:</span> ${request.target?.email}</p>
              <p><span class="label">Equipe:</span> ${request.target?.team?.name}</p>
              <p><span class="label">Ciência:</span> ${request.target_confirmation ? 'Confirmada' : 'Pendente'}</p>
            </div>

            <div class="section">
              <h3>Motivo da Troca</h3>
              <p>${request.reason}</p>
            </div>

            ${request.admin_approved_at ? `
              <div class="section">
                <h3>Decisão Administrativa</h3>
                <p><span class="label">Decidido em:</span> ${format(new Date(request.admin_approved_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                <p><span class="label">Decidido por:</span> ${request.admin_approver?.name}</p>
              </div>
            ` : ''}

            <div class="footer">
              <p>Documento gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
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
      <div className="space-y-4">
        {filteredRequests.map((request) => (
          <Card key={request.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
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
                    <div className="text-sm text-muted-foreground">Data da Troca</div>
                    <div className="font-medium">
                      {format(new Date(request.swap_date), 'dd/MM/yyyy', { locale: ptBR })}
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

      {filteredRequests.length === 0 && (
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
      )}

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
                Data: {selectedRequest && format(new Date(selectedRequest.swap_date), 'dd/MM/yyyy', { locale: ptBR })}
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