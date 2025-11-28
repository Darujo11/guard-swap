import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { TeamScheduleCalendar } from '@/components/schedule/TeamScheduleCalendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SwapRequest } from '@/lib/types';

import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar,
  BarChart3,
  ArrowUpRight,
  Filter,
  Trash2
} from 'lucide-react';

const AdminDashboard = () => {
  const { profile } = useAuth();
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingSwaps: 0,
    approvedSwaps: 0,
    rejectedSwaps: 0,
    totalGuards: 0,
  });
  const [decisionDialog, setDecisionDialog] = useState<{
    open: boolean;
    request: SwapRequest | null;
    action: 'APPROVED' | 'REJECTED' | null;
  }>({ open: false, request: null, action: null });
  const [decisionReason, setDecisionReason] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<SwapRequest | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;
    try {
      // Solicitações aceitas pelo alvo aguardando aprovação do admin
      const { data: swaps, error: swapsError } = await supabase
        .from('swap_requests')
        .select(`
          *,
          requester:profiles!swap_requests_requester_id_fkey(
            id,
            name,
            team:teams(id, name)
          ),
          target:profiles!swap_requests_target_id_fkey(
            id,
            name,
            team:teams(id, name)
          )
        `)
        .eq('status', 'ACCEPTED')
        .eq('target_confirmation', true)
        .eq('admin_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (swapsError) throw swapsError;

      setSwapRequests(((swaps || []) as unknown) as SwapRequest[]);

      // Buscar estatísticas (somente do admin atual)
      const [{ data: allSwaps }, { data: guardRoles, error: rolesError }] = await Promise.all([
        supabase
          .from('swap_requests')
          .select('status')
          .eq('admin_id', profile.id),
        supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'guard'),
      ]);

      if (rolesError) throw rolesError;

      const guardUserIds = (guardRoles || []).map((r: any) => r.user_id);
      let totalGuards = 0;
      if (guardUserIds.length > 0) {
        const { data: guardProfiles, error: guardsError } = await supabase
          .from('profiles')
          .select('id, user_id')
          .eq('admin_id', profile.id)
          .in('user_id', guardUserIds);
        if (guardsError) throw guardsError;
        totalGuards = guardProfiles?.length || 0;
      }

      setStats({
        pendingSwaps: (allSwaps || []).filter((s: any) => s.status === 'PENDING' || s.status === 'ACCEPTED').length,
        approvedSwaps: (allSwaps || []).filter((s: any) => s.status === 'APPROVED').length,
        rejectedSwaps: (allSwaps || []).filter((s: any) => s.status === 'REJECTED').length,
        totalGuards,
      });
    } catch (error) {
      console.error('[AdminDashboard][FetchData]', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as solicitações.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openDecisionDialog = (request: SwapRequest, action: 'APPROVED' | 'REJECTED') => {
    setDecisionDialog({ open: true, request, action });
    setDecisionReason('');
  };

  const handleDecision = async () => {
    if (!decisionDialog.request || !decisionDialog.action) return;

    try {
      if (!profile?.id) throw new Error('Perfil não encontrado');

      const { error } = await supabase
        .from('swap_requests')
        .update({
          status: decisionDialog.action,
          admin_approved: decisionDialog.action === 'APPROVED',
          admin_approved_by: profile.id,
          admin_approved_at: new Date().toISOString(),
        })
        .eq('id', decisionDialog.request.id);

      if (error) throw error;

      // Registrar no log de auditoria
      await supabase.from('audit_logs').insert({
        entity_type: 'swap_request',
        entity_id: decisionDialog.request.id,
        action: decisionDialog.action === 'APPROVED' ? 'approved' : 'rejected',
        user_id: profile.id,
        details: { reason: decisionReason },
      });

      // Enviar webhook para aprovação ou rejeição do admin
      try {
        const webhookPayload = {
          evento: decisionDialog.action === 'APPROVED' ? 'troca_aprovada_admin' : 'troca_rejeitada_admin',
          aprovacao_chefe_estado: decisionDialog.action === 'APPROVED' ? 'aprovado' : 'rejeitado',
          requester_name: decisionDialog.request.requester?.name || '',
          requester_email: decisionDialog.request.requester?.email || '',
          requester_phone: decisionDialog.request.requester?.phone || '',
          target_name: decisionDialog.request.target?.name || '',
          target_email: decisionDialog.request.target?.email || '',
          target_phone: decisionDialog.request.target?.phone || '',
          requester_shift_date: decisionDialog.request.requester_shift_date,
          target_shift_date: decisionDialog.request.target_shift_date,
          reason: decisionDialog.request.reason,
          ...(decisionDialog.action === 'REJECTED' && { rejection_reason: decisionReason }),
          status: decisionDialog.action,
          admin_approved: decisionDialog.action === 'APPROVED',
          [decisionDialog.action === 'APPROVED' ? 'approved_at' : 'rejected_at']: new Date().toISOString(),
        };

        console.log(`📤 [AdminDashboard][Webhook] Enviando payload de ${decisionDialog.action === 'APPROVED' ? 'aprovação' : 'rejeição'} admin:`, webhookPayload);

        const { data: webhookData, error: webhookError } = await supabase.functions.invoke('send-swap-webhook', {
          body: webhookPayload
        });

        if (webhookError) {
          console.error('⚠️ [AdminDashboard][Webhook] Erro ao enviar webhook:', webhookError);
        } else {
          console.log('✅ [AdminDashboard][Webhook] Webhook enviado com sucesso:', webhookData);
        }
      } catch (webhookError) {
        console.error('⚠️ [AdminDashboard][Webhook] Exceção ao enviar webhook:', webhookError);
        // Não falhar a operação principal se webhook falhar
      }

      toast({
        title: decisionDialog.action === 'APPROVED' ? 'Solicitação aprovada' : 'Solicitação rejeitada',
        description: `A troca foi ${decisionDialog.action === 'APPROVED' ? 'aprovada' : 'rejeitada'} com sucesso.`,
      });

      setDecisionDialog({ open: false, request: null, action: null });
      fetchData();
    } catch (error) {
      console.error('[AdminDashboard][HandleDecision]', error);
      toast({
        title: 'Erro ao processar decisão',
        description: 'Não foi possível processar sua decisão.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!requestToDelete) return;

    try {
      const { error } = await supabase
        .from('swap_requests')
        .delete()
        .eq('id', requestToDelete.id);

      if (error) throw error;

      toast({
        title: 'Solicitação excluída',
        description: 'A solicitação de troca foi removida com sucesso.',
      });

      await fetchData();
      setIsDeleteDialogOpen(false);
      setRequestToDelete(null);
    } catch (error) {
      console.error('[AdminDashboard][HandleDelete]', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a solicitação.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <AppLayout title="Dashboard Administrativo" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!loading && !profile) {
    return (
      <AppLayout title="Dashboard Administrativo" user={{ name: 'Admin', role: 'ADMIN' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Perfil não encontrado</h3>
            <p className="text-muted-foreground">
              Seu perfil de administrador não foi encontrado no sistema.
              <br />
              Por favor, entre em contato com o suporte.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Dashboard Administrativo"
      user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}
    >
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trocas Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pendingSwaps}</div>
            <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.approvedSwaps}</div>
            <p className="text-xs text-muted-foreground">Total aprovadas</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
            <XCircle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stats.rejectedSwaps}</div>
            <p className="text-xs text-muted-foreground">Total rejeitadas</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Seguranças</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGuards}</div>
            <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
          </CardContent>
        </Card>
      </div>

      {/* Swap Requests */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Solicitações de Troca
              </CardTitle>
              <CardDescription className="mt-2">
                Gerencie as solicitações de troca de plantão
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto" asChild>
                <Link to="/admin/equipes">
                  <Users className="h-4 w-4" />
                  Gerenciar Equipes
                </Link>
              </Button>
              <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto" asChild>
                <Link to="/admin/trocas">
                  <Filter className="h-4 w-4" />
                  Gerenciar Trocas
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {swapRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma solicitação pendente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {swapRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{request.requester?.name}</span>
                      {request.requester?.team && <TeamBadge team={request.requester.team} />}
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{request.target?.name}</span>
                      {request.target?.team && <TeamBadge team={request.target.team} />}
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>
                        <strong>Troca:</strong> {formatDate(request.requester_shift_date)} → {formatDate(request.target_shift_date)}
                      </div>
                      {request.reason && (
                        <div>
                          <strong>Motivo:</strong> {request.reason}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Solicitado em {formatDate(request.created_at)} às {formatTime(request.created_at)}</span>
                    </div>
                    
                    <div className="mt-2">
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Aceita por {request.target?.name} - Aguardando aprovação
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-3 sm:mt-0">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openDecisionDialog(request, 'APPROVED')}
                      className="gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Aprovar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDecisionDialog(request, 'REJECTED')}
                      className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRequestToDelete(request);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Calendar */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Calendar className="h-5 w-5" />
                <span className="break-words">Escala de Plantões - Todas as Equipes</span>
              </CardTitle>
              <CardDescription className="mt-2">
                Gerencie a escala completa de todas as equipes
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto" asChild>
              <Link to="/admin/escalas">
                <Calendar className="h-4 w-4" />
                Gerenciar Escala
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TeamScheduleCalendar />
        </CardContent>
      </Card>

      {/* Decision Dialog */}
      <Dialog open={decisionDialog.open} onOpenChange={(open) => setDecisionDialog({ ...decisionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionDialog.action === 'APPROVED' ? 'Aprovar Solicitação' : 'Rejeitar Solicitação'}
            </DialogTitle>
            <DialogDescription>
              {decisionDialog.action === 'APPROVED' 
                ? 'Você está prestes a aprovar esta troca de plantão. Deseja adicionar uma observação?'
                : 'Você está prestes a rejeitar esta troca de plantão. Por favor, informe o motivo.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">
                {decisionDialog.action === 'APPROVED' ? 'Observação (opcional)' : 'Motivo da rejeição'}
              </Label>
              <Textarea
                id="reason"
                placeholder={decisionDialog.action === 'APPROVED' 
                  ? 'Adicione uma observação...'
                  : 'Explique o motivo da rejeição...'}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialog({ open: false, request: null, action: null })}>
              Cancelar
            </Button>
            <Button
              variant={decisionDialog.action === 'APPROVED' ? 'default' : 'destructive'}
              onClick={handleDecision}
            >
              {decisionDialog.action === 'APPROVED' ? 'Aprovar' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir esta solicitação de troca? Esta ação não pode ser desfeita.
            </p>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Troca entre</div>
              <div className="font-medium">
                {requestToDelete?.requester?.name} ↔ {requestToDelete?.target?.name}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Datas: {requestToDelete && (
                  <>
                    {formatDate(requestToDelete.requester_shift_date)} → {formatDate(requestToDelete.target_shift_date)}
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
            >
              Excluir Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminDashboard;