import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SwapRequest, Profile } from '@/lib/types';
import { 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRightLeft,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  FileDown,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { printSwapReceipt } from '@/utils/printSwapReceipt';


interface GuardSwapListProps {
  currentUser: Profile;
}

export function GuardSwapList({ currentUser }: GuardSwapListProps) {
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SwapRequest | null>(null);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [responseAction, setResponseAction] = useState<'accept' | 'reject' | null>(null);
  const [responseReason, setResponseReason] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Helper para converter string YYYY-MM-DD em data local (evita problemas de timezone)
  const parseDateOnly = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  useEffect(() => {
    fetchSwapRequests();
    
    // Set up real-time subscription for swap requests
    // Listen to all changes and filter in the query
    const channel = supabase
      .channel('swap-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swap_requests'
        },
        (payload) => {
          // Always refetch on DELETE to avoid missing payload.old when replica identity is not FULL
          if ((payload as any).eventType === 'DELETE') {
            fetchSwapRequests();
            return;
          }
          
          // Check if the change affects the current user
          const record = (payload as any).new as any;
          if (record && (record.requester_id === currentUser.id || record.target_id === currentUser.id)) {
            console.log('[GuardSwapList] Change affects current user, refetching...');
            fetchSwapRequests();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id]);

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
        .or(`requester_id.eq.${currentUser.id},target_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSwapRequests((data || []) as SwapRequest[]);
    } catch (error) {
      console.error('[GuardSwapList][FetchData]', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as solicitações de troca.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async () => {
    if (!selectedRequest || !responseAction) return;

    try {
      const updateData = {
        status: responseAction === 'accept' ? 'ACCEPTED' : 'REJECTED',
        target_confirmation: responseAction === 'accept'
      };

      const { error } = await supabase
        .from('swap_requests')
        .update(updateData)
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Create audit log
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action: responseAction === 'accept' ? 'SWAP_ACCEPTED' : 'SWAP_REJECTED_BY_TARGET',
        entity_type: 'swap_request',
        entity_id: selectedRequest.id,
        details: {
          reason: responseReason,
          requester_id: selectedRequest.requester_id
        }
      });

      toast({
        title: `Solicitação ${responseAction === 'accept' ? 'aceita' : 'rejeitada'}`,
        description: `Você ${responseAction === 'accept' ? 'aceitou' : 'rejeitou'} a solicitação de troca.`,
      });

      await fetchSwapRequests();
      setIsResponseDialogOpen(false);
      setResponseReason('');
      setSelectedRequest(null);
    } catch (error) {
      console.error('[GuardSwapList][HandleResponse]', error);
      toast({
        title: 'Erro ao processar',
        description: 'Não foi possível processar sua resposta.',
        variant: 'destructive',
      });
    }
  };

  const openResponseDialog = (request: SwapRequest, action: 'accept' | 'reject') => {
    setSelectedRequest(request);
    setResponseAction(action);
    setIsResponseDialogOpen(true);
  };

  const cancelRequest = async (request: SwapRequest) => {
    if (!confirm('Tem certeza que deseja cancelar esta solicitação?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('swap_requests')
        .update({ status: 'CANCELLED' })
        .eq('id', request.id);

      if (error) throw error;

      // Create audit log
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action: 'SWAP_CANCELLED',
        entity_type: 'swap_request',
        entity_id: request.id,
        details: {
          target_id: request.target_id
        }
      });

      toast({
        title: 'Solicitação cancelada',
        description: 'A solicitação de troca foi cancelada.',
      });

      await fetchSwapRequests();
    } catch (error) {
      console.error('[GuardSwapList][CancelRequest]', error);
      toast({
        title: 'Erro ao cancelar',
        description: 'Não foi possível cancelar a solicitação.',
        variant: 'destructive',
      });
    }
  };

  const deleteRequest = async (request: SwapRequest) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente esta solicitação? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('swap_requests')
        .delete()
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: 'Solicitação excluída',
        description: 'A solicitação de troca foi removida permanentemente.',
      });

      await fetchSwapRequests();
    } catch (error) {
      console.error('[GuardSwapList][DeleteRequest]', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a solicitação.',
        variant: 'destructive',
      });
    }
  };

  const getRequestTypeLabel = (request: SwapRequest) => {
    return request.requester_id === currentUser.id ? 'Enviada' : 'Recebida';
  };

  const getRequestTypeColor = (request: SwapRequest) => {
    return request.requester_id === currentUser.id ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  const canRespond = (request: SwapRequest) => {
    return request.target_id === currentUser.id && request.status === 'PENDING';
  };

  const canCancel = (request: SwapRequest) => {
    return request.requester_id === currentUser.id && request.status === 'PENDING';
  };

  const canDelete = (request: SwapRequest) => {
    // Após aprovação do coordenador, só o coordenador pode excluir a troca
    return request.requester_id === currentUser.id && request.status !== 'APPROVED';
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [monthKey]: !prev[monthKey]
    }));
  };

  const generatePDF = async (request: SwapRequest) => {
    try {
      const opened = await printSwapReceipt(request);
      if (!opened) {
        toast({
          title: 'Janela bloqueada',
          description: 'Permita pop-ups para este site para imprimir ou salvar o comprovante.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[GuardSwapList][GeneratePDF]', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar o PDF da solicitação.',
        variant: 'destructive',
      });
    }
  };

  // Agrupar solicitações pelos meses envolvidos na troca (requester_shift_date e target_shift_date)
  const groupedByMonth = swapRequests.reduce((acc, request) => {
    const getMonthKey = (dateStr: string | null | undefined) => {
      if (!dateStr) return null;
      const [y, m] = dateStr.split('-');
      if (!y || !m) return null;
      return `${y}-${m}`;
    };

    const months = new Set<string>();
    const m1 = getMonthKey(request.requester_shift_date);
    const m2 = getMonthKey(request.target_shift_date);
    if (m1) months.add(m1);
    if (m2) months.add(m2);

    months.forEach((monthKey) => {
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(request);
    });

    return acc;
  }, {} as Record<string, SwapRequest[]>);

  // Ordenar as chaves dos meses (mais recente primeiro)
  const sortedMonthKeys = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

  // Inicializar todos os meses como expandidos na primeira renderização
  useEffect(() => {
    if (sortedMonthKeys.length > 0 && Object.keys(expandedMonths).length === 0) {
      const initialExpanded: Record<string, boolean> = {};
      sortedMonthKeys.forEach(key => {
        initialExpanded[key] = true;
      });
      setExpandedMonths(initialExpanded);
    }
  }, [sortedMonthKeys.length]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Carregando solicitações...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Minhas Solicitações de Troca
          </CardTitle>
          <CardDescription>
            Acompanhe suas solicitações de troca enviadas e recebidas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {swapRequests.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-medium mb-2">Nenhuma solicitação</h3>
              <p className="text-sm text-muted-foreground">
                Você ainda não possui solicitações de troca.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedMonthKeys.map((monthKey) => {
                const monthRequests = groupedByMonth[monthKey];
                const [year, month] = monthKey.split('-');
                const monthDate = new Date(Number(year), Number(month) - 1, 1);
                const monthLabel = format(monthDate, 'MMMM yyyy', { locale: ptBR });
                const isExpanded = expandedMonths[monthKey] ?? true;
                
                return (
                  <div key={monthKey} className="space-y-3">
                    <button
                      onClick={() => toggleMonth(monthKey)}
                      className="flex items-center gap-2 pb-2 border-b w-full hover:bg-muted/50 transition-colors rounded-t px-2 -mx-2"
                    >
                      <Calendar className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm capitalize">{monthLabel}</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {monthRequests.length} {monthRequests.length === 1 ? 'solicitação' : 'solicitações'}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <div className="space-y-3">
                      {monthRequests.map((request) => {
                        return (
                          <div
                            key={request.id}
                            className="p-5 border rounded-lg hover:bg-muted/30 transition-colors space-y-4"
                          >
                            {/* Header com Protocolo e Status */}
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-3 flex-wrap">
                                <Badge variant="secondary" className="font-mono text-xs">
                                  Protocolo: {request.id.slice(0, 8)}
                                </Badge>
                                <StatusBadge status={request.status} />
                              </div>
                              
                              {request.status === 'APPROVED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => generatePDF(request)}
                                  className="gap-2"
                                >
                                  <FileDown className="h-4 w-4" />
                                  PDF
                                </Button>
                              )}
                            </div>

                            {/* Pendências de Aprovação */}
                            {request.status === 'PENDING' && request.target_id === currentUser.id && (
                              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg">
                                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                                    ⚠️ Aguardando sua confirmação
                                  </p>
                                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                                    Você precisa aceitar ou rejeitar esta solicitação de troca
                                  </p>
                                </div>
                              </div>
                            )}

                            {request.status === 'PENDING' && request.requester_id === currentUser.id && (
                              <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg">
                                <Clock className="h-5 w-5 text-orange-600 dark:text-orange-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                                    ⏳ Pendências de Aprovação
                                  </p>
                                  <div className="space-y-2 mt-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                      <p className="text-xs text-orange-700 dark:text-orange-300">
                                        <strong>1. Membro Convidado:</strong> Aguardando {request.target?.name} aceitar a troca
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                      <p className="text-xs text-orange-700 dark:text-orange-300">
                                        <strong>2. Administrador:</strong> Aguardará aprovação após aceite do membro
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {request.status === 'ACCEPTED' && (
                              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    ⏳ Aguardando Aprovação do Administrador
                                  </p>
                                  <div className="space-y-2 mt-2">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                      <p className="text-xs text-blue-700 dark:text-blue-300">
                                        <strong>1. Membro Convidado:</strong> {request.target?.name} aceitou a troca ✓
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                      <p className="text-xs text-blue-700 dark:text-blue-300">
                                        <strong>2. Administrador:</strong> Aguardando aprovação final
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {request.status === 'APPROVED' && (
                              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                    ✅ Troca Aprovada e Confirmada
                                  </p>
                                  <div className="space-y-1 mt-2">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                      <p className="text-xs text-green-700 dark:text-green-300">
                                        Membro convidado aceitou ✓
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                      <p className="text-xs text-green-700 dark:text-green-300">
                                        Administrador aprovou ✓
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Solicitante e Membro Convidado */}
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <div className="text-sm text-muted-foreground mb-1">Solicitante</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{request.requester?.name}</span>
                                  {request.requester?.team && (
                                    <TeamBadge team={request.requester.team} />
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground mb-1">Membro Convidado</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{request.target?.name}</span>
                                  {request.target?.team && (
                                    <TeamBadge team={request.target.team} />
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Datas da Troca */}
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Datas da Troca</div>
                              <div className="font-medium">
                                {format(parseDateOnly(request.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                                {' → '}
                                {format(parseDateOnly(request.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Plantão do solicitante → Plantão desejado
                              </div>
                            </div>

                            {/* Motivo */}
                            <div>
                              <div className="text-sm text-muted-foreground mb-1">Motivo</div>
                              <div className="text-sm">{request.reason}</div>
                            </div>

                            {/* Data de solicitação */}
                            <div className="text-xs text-muted-foreground pt-2 border-t">
                              Solicitado em {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </div>

                            {/* Ações */}
                            {(canRespond(request) || canCancel(request) || canDelete(request)) && (
                              <div className="flex flex-wrap gap-2 pt-2">
                                {canRespond(request) && (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => openResponseDialog(request, 'accept')}
                                      className="gap-2 bg-success hover:bg-success/90 text-success-foreground"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                      Aceitar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openResponseDialog(request, 'reject')}
                                      className="gap-2 text-danger hover:bg-danger hover:text-danger-foreground"
                                    >
                                      <XCircle className="h-4 w-4" />
                                      Rejeitar
                                    </Button>
                                  </>
                                )}
                                
                                {canCancel(request) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cancelRequest(request)}
                                    className="gap-2"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Cancelar
                                  </Button>
                                )}

                                {canDelete(request) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteRequest(request)}
                                    className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Excluir
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* Troca aprovada: exclusão apenas pelo coordenador */}
                            {request.requester_id === currentUser.id && request.status === 'APPROVED' && (
                              <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                Trocas aprovadas só podem ser removidas pelo coordenador.
                              </div>
                            )}
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Dialog */}
      <Dialog open={isResponseDialogOpen} onOpenChange={setIsResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {responseAction === 'accept' ? 'Aceitar' : 'Rejeitar'} Solicitação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Solicitação de</div>
              <div className="font-medium">{selectedRequest?.requester?.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                Datas: {selectedRequest && (
                  <>
                    {format(parseDateOnly(selectedRequest.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                    {' → '}
                    {format(parseDateOnly(selectedRequest.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </>
                )}
              </div>
              <div className="text-sm mt-2">
                <span className="text-muted-foreground">Motivo:</span> {selectedRequest?.reason}
              </div>
            </div>
            <div>
              <Label htmlFor="responseReason">
                {responseAction === 'accept' ? 'Observações (opcional)' : 'Motivo da rejeição'}
              </Label>
              <Textarea
                id="responseReason"
                value={responseReason}
                onChange={(e) => setResponseReason(e.target.value)}
                placeholder={
                  responseAction === 'accept'
                    ? 'Observações sobre a aceitação...'
                    : 'Explique o motivo da rejeição...'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResponseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleResponse}
              className={responseAction === 'accept' ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'}
            >
              {responseAction === 'accept' ? 'Aceitar' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}