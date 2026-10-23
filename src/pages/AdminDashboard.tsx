import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { TeamScheduleCalendar } from '@/components/schedule/TeamScheduleCalendar';
import { AdminDutyCalendar } from '@/components/schedule/AdminDutyCalendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { SwapRequest } from '@/lib/types';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SignatureFields } from '@/components/swaps/SignatureFields';
import { useSignatureFields } from '@/hooks/useSignatureFields';
import { describeSignatureError, signSwapAction } from '@/lib/swapSignature';

import {
  Users,
  CheckCircle,
  XCircle,
  Calendar,
  ArrowUpRight,
  Filter,
  Trash2,
  Scale,
  Download
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
  const [signing, setSigning] = useState(false);
  const signature = useSignatureFields();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<SwapRequest | null>(null);
  const [calendarReloadKey, setCalendarReloadKey] = useState(0);
  
  // TRE leave states
  const [pendingTreLeaves, setPendingTreLeaves] = useState<any[]>([]);
  
  const { toast } = useToast();

  useEffect(() => {
    if (profile?.id) {
      fetchData();
      fetchPendingTreLeaves();
    }
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;
    try {
      // Solicitações aceitas pelo alvo aguardando aprovação do admin.
      // IMPORTANTE: filtrar por target_confirmation = true, não só por status.
      // Sem isso, trocas ainda PENDING (alvo nunca respondeu) apareciam aqui com o
      // badge "Aceita — aguardando aprovação" e o botão Aprovar, permitindo que o
      // admin aprovasse uma troca que o segurança-alvo nunca confirmou.
      const { data: swaps, error: swapsError } = await supabase
        .from('swap_requests')
        .select(`
          *,
          requester:profiles!swap_requests_requester_id_fkey(
            id,
            name,
            email,
            phone,
            team:teams(id, name)
          ),
          target:profiles!swap_requests_target_id_fkey(
            id,
            name,
            email,
            phone,
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

  const fetchPendingTreLeaves = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('leaves')
        .select('*, guard:profiles!leaves_guard_id_fkey(id, name, phone, team:teams(name))')
        .eq('admin_id', profile.id)
        .eq('leave_type', 'TRE')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPendingTreLeaves(data || []);
    } catch (error) {
      console.error('[AdminDashboard][FetchTreLeaves]', error);
    }
  };

  const handleTreDecision = async (leave: any, approved: boolean) => {
    try {
      const { error } = await supabase
        .from('leaves')
        .update({ status: approved ? 'APPROVED' : 'REJECTED' })
        .eq('id', leave.id);
      if (error) throw error;

      // Notify guard via WhatsApp (fire-and-forget)
      supabase.functions.invoke('notify-tre-leave-guard', {
        body: {
          guard_name: leave.guard?.name || '',
          guard_phone: leave.guard?.phone || '',
          leave_date: format(new Date(leave.start_date + 'T00:00:00'), 'dd/MM/yyyy'),
          admin_name: profile?.name || '',
          approved,
        },
      }).catch((err) => console.warn('[AdminDashboard] Falha ao notificar segurança:', err));

      toast({
        title: approved ? 'Afastamento aprovado' : 'Afastamento rejeitado',
        description: `O afastamento TRE de ${leave.guard?.name} foi ${approved ? 'aprovado' : 'rejeitado'}.`,
      });
      fetchPendingTreLeaves();
    } catch (error) {
      console.error('[AdminDashboard][TreDecision]', error);
      toast({ title: 'Erro', description: 'Não foi possível processar a decisão.', variant: 'destructive' });
    }
  };

  const generateTreLeavePDF = (leave: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Solicitação de Afastamento TRE", pageWidth / 2, 25, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    let y = 45;
    const lineH = 8;

    if (leave.protocol) {
      doc.text(`Protocolo: ${leave.protocol}`, 14, y); y += lineH;
    }
    doc.text(`Segurança: ${leave.guard?.name || 'N/A'}`, 14, y); y += lineH;
    doc.text(`Equipe: ${leave.guard?.team?.name || 'N/A'}`, 14, y); y += lineH;
    doc.text(`Data do Afastamento: ${format(new Date(leave.start_date + 'T00:00:00'), 'dd/MM/yyyy')}`, 14, y); y += lineH;
    doc.text(`Data da Solicitação: ${format(new Date(leave.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, y); y += lineH;
    
    const statusLabel = leave.status === 'APPROVED' ? 'Aprovada' : leave.status === 'REJECTED' ? 'Rejeitada' : 'Pendente';
    doc.text(`Status: ${statusLabel}`, 14, y); y += lineH * 2;

    doc.text(`Coordenador: ${profile?.name || 'N/A'}`, 14, y); y += lineH;

    doc.setFontSize(8);
    doc.text('Gerado pelo Sistema Guard Swap', pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });

    doc.save(`afastamento-tre-${leave.protocol || leave.id}.pdf`);
  };

  const openDecisionDialog = (request: SwapRequest, action: 'APPROVED' | 'REJECTED') => {
    setDecisionDialog({ open: true, request, action });
    setDecisionReason('');
    signature.reset();
  };

  const handleDecision = async () => {
    if (!decisionDialog.request || !decisionDialog.action || !signature.ready) return;
    const request = decisionDialog.request;
    const action = decisionDialog.action;

    setSigning(true);
    try {
      if (!profile?.id) throw new Error('Perfil não encontrado');

      // Assinatura eletrônica: a decisão sai pela sessão em que a senha acabou de ser confirmada.
      const { error } = await signSwapAction(signature.password, (signer) => signer
        .from('swap_requests')
        .update({
          status: action,
          admin_approved: action === 'APPROVED',
          admin_approved_by: profile.id,
          admin_approved_at: new Date().toISOString(),
        })
        .eq('id', request.id));

      if (error) throw error;

      // Registrar no log de auditoria
      await supabase.from('audit_logs').insert({
        entity_type: 'swap_request',
        entity_id: decisionDialog.request.id,
        action: decisionDialog.action === 'APPROVED' ? 'approved' : 'rejected',
        user_id: profile.id,
        details: { reason: decisionReason },
      });

      toast({
        title: decisionDialog.action === 'APPROVED' ? 'Solicitação aprovada' : 'Solicitação rejeitada',
        description: `A troca foi ${decisionDialog.action === 'APPROVED' ? 'aprovada' : 'rejeitada'} com sucesso.`,
      });

      setDecisionDialog({ open: false, request: null, action: null });
      signature.reset();
      fetchData();
      setCalendarReloadKey((prev) => prev + 1);
    } catch (error) {
      console.error('[AdminDashboard][HandleDecision]', error);
      toast({
        title: 'Erro ao processar decisão',
        description: describeSignatureError(error) ?? 'Não foi possível processar sua decisão.',
        variant: 'destructive',
      });
    } finally {
      setSigning(false);
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
      setCalendarReloadKey((prev) => prev + 1);
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
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
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
      <div className="flex flex-col gap-6">
        {/* Swap Requests - Order 1 on mobile, Order 2 on desktop */}
        <Card className="order-1 md:order-2">
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

        {/* TRE Leave Requests */}
        {pendingTreLeaves.length > 0 && (
          <Card className="order-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Solicitações de Afastamento TRE
              </CardTitle>
              <CardDescription>
                {pendingTreLeaves.length} solicitação(ões) pendente(s) de aprovação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pendingTreLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{leave.guard?.name || 'N/A'}</span>
                        {leave.guard?.team && (
                          <Badge variant="outline">{leave.guard.team.name}</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <strong>Data do afastamento:</strong> {format(new Date(leave.start_date + 'T00:00:00'), 'dd/MM/yyyy')}
                      </div>
                      {leave.protocol && (
                        <div className="text-xs text-muted-foreground">
                          Protocolo: {leave.protocol}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Solicitado em {format(new Date(leave.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 sm:mt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateTreLeavePDF(leave)}
                        title="Baixar PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleTreDecision(leave, true)}
                        className="gap-1"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTreDecision(leave, false)}
                        className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <AdminDutyCalendar reloadKey={calendarReloadKey} />

        {/* Schedule Calendar - Order 3 */}
        <Card className="order-3">
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

        {/* Footer Card */}
        <Card className="order-4">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Trocas aprovadas</p>
              <p className="text-2xl font-bold text-success">{stats.approvedSwaps}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Decision Dialog */}
      <Dialog
        open={decisionDialog.open}
        onOpenChange={(open) => {
          setDecisionDialog({ ...decisionDialog, open });
          if (!open) signature.reset();
        }}
      >
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
            <SignatureFields
              action={decisionDialog.action === 'APPROVED' ? 'APROVOU' : 'REJEITOU'}
              agreed={signature.agreed}
              onAgreedChange={signature.setAgreed}
              password={signature.password}
              onPasswordChange={signature.setPassword}
              disabled={signing}
              idPrefix="decidir-painel"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDecisionDialog({ open: false, request: null, action: null })}
              disabled={signing}
            >
              Cancelar
            </Button>
            <Button
              variant={decisionDialog.action === 'APPROVED' ? 'default' : 'destructive'}
              onClick={handleDecision}
              disabled={!signature.ready || signing}
            >
              {signing ? 'Assinando...' : decisionDialog.action === 'APPROVED' ? 'Assinar e aprovar' : 'Assinar e rejeitar'}
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