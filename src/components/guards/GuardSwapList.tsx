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
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const { toast } = useToast();

  useEffect(() => {
    fetchSwapRequests();
    
    // Set up real-time subscription for swap requests
    const channel = supabase
      .channel('swap-requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swap_requests',
          filter: `requester_id=eq.${currentUser.id},target_id=eq.${currentUser.id}`
        },
        () => {
          fetchSwapRequests();
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
            <div className="space-y-4">
              {swapRequests.map((request) => {
                const isRequester = request.requester_id === currentUser.id;
                const otherUser = isRequester ? request.target : request.requester;
                
                return (
                  <div
                    key={request.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className={getRequestTypeColor(request)}>
                            {getRequestTypeLabel(request)}
                          </Badge>
                          <StatusBadge status={request.status} />
                          {request.status === 'ACCEPTED' && !request.target_confirmation && (
                            <Badge variant="outline" className="text-warning border-warning">
                              Aguardando Admin
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <div className="text-sm text-muted-foreground">
                              {isRequester ? 'Para' : 'De'}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{otherUser?.name}</span>
                              {otherUser?.team && (
                                <TeamBadge team={otherUser.team} />
                              )}
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
                              Seu plantão → Plantão desejado
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm text-muted-foreground">Motivo</div>
                          <div className="text-sm">{request.reason}</div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Criado em {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          {request.admin_approved_at && (
                            <> • Decidido em {format(new Date(request.admin_approved_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 lg:w-auto w-full">
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

                        {request.status === 'ACCEPTED' && request.target_confirmation && (
                          <Badge variant="outline" className="text-center py-2 text-info border-info">
                            <Clock className="h-3 w-3 mr-1" />
                            Aguardando Admin
                          </Badge>
                        )}
                      </div>
                    </div>
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
                    {format(new Date(selectedRequest.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                    {' → '}
                    {format(new Date(selectedRequest.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
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