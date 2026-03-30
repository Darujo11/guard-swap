import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TeamBadge } from '@/components/ui/team-badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Profile, Team } from '@/lib/types';
import { CalendarDays, ArrowRightLeft, Calendar as CalendarIcon, ShieldOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getEffectiveDatesSet } from '@/utils/effectiveSchedule';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';

interface TeamSchedule {
  id: string;
  team_id: string;
  shift_date: string;
  team?: Team;
}

interface GuardSwapFormProps {
  currentUser: Profile;
  onClose?: () => void;
  onSwapCreated?: () => void;
}

export function GuardSwapForm({ currentUser, onClose, onSwapCreated }: GuardSwapFormProps) {
  const [availableGuards, setAvailableGuards] = useState<Profile[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [requesterShiftDate, setRequesterShiftDate] = useState<Date | undefined>();
  const [targetShiftDate, setTargetShiftDate] = useState<Date | undefined>();
  const [schedules, setSchedules] = useState<TeamSchedule[]>([]);
  const [approvedSwaps, setApprovedSwaps] = useState<any[]>([]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [requesterCalendarOpen, setRequesterCalendarOpen] = useState(false);
  const [targetCalendarOpen, setTargetCalendarOpen] = useState(false);
  const { toast } = useToast();
  const { settings } = useOrganizationSettings();

  if (settings.swaps_blocked) {
    return (
      <Card className="p-8 text-center">
        <CardContent className="flex flex-col items-center gap-4 pt-6">
          <ShieldOff className="h-12 w-12 text-destructive" />
          <h3 className="text-xl font-bold">Acesso Restrito</h3>
          <p className="text-muted-foreground">Trocas bloqueadas no sistema pelo coordenador.</p>
        </CardContent>
      </Card>
    );
  }

  useEffect(() => {
    fetchAvailableGuards();
    fetchSchedules();
    fetchApprovedSwapsData();
  }, [currentUser]);

  const fetchAvailableGuards = async () => {
    try {
      if (!currentUser.team_id) {
        toast({
          title: 'Sem equipe',
          description: 'Você precisa estar em uma equipe para solicitar trocas.',
          variant: 'destructive',
        });
        setAvailableGuards([]);
        return;
      }

      // Usar função RPC que bypassa RLS de forma segura
      const { data, error } = await supabase
        .rpc('get_available_guards_for_swap');

      if (error) throw error;

      // Converter para formato esperado pelo componente
      const guards = (data || []).map((guard: any) => ({
        id: guard.id,
        name: guard.name,
        email: guard.email,
        phone: guard.phone,
        team_id: guard.team_id,
        team: guard.team_name ? {
          id: guard.team_id,
          name: guard.team_name,
          color: guard.team_color
        } : null
      }));

      setAvailableGuards(guards as Profile[]);
    } catch (error) {
      console.error('[GuardSwapForm][FetchGuards]', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os guardas disponíveis.',
        variant: 'destructive',
      });
    }
  };

  const fetchSchedules = async () => {
    try {
      const today = new Date();
      const maxDate = new Date('2027-12-31');

      const { data, error } = await supabase
        .from('team_schedules')
        .select(`
          *,
          team:teams(*)
        `)
        .gte('shift_date', today.toISOString().split('T')[0])
        .lte('shift_date', maxDate.toISOString().split('T')[0]);

      if (error) throw error;
      setSchedules((data || []) as TeamSchedule[]);
    } catch (error) {
      console.error('[GuardSwapForm][FetchSchedules]', error);
    }
  };

  const fetchApprovedSwapsData = async () => {
    try {
      const { data, error } = await supabase
        .from('swap_requests')
        .select(`
          requester_id, target_id, requester_shift_date, target_shift_date,
          requester:profiles!swap_requests_requester_id_fkey(id, team_id),
          target:profiles!swap_requests_target_id_fkey(id, team_id)
        `)
        .eq('status', 'APPROVED');

      if (error) throw error;
      setApprovedSwaps(data || []);
    } catch (error) {
      console.error('[GuardSwapForm][FetchApprovedSwaps]', error);
    }
  };

  // Escala efetiva do solicitante (meus dias reais de trabalho)
  const myEffectiveDates = useMemo(() => {
    if (!currentUser.team_id) return new Set<string>();
    return getEffectiveDatesSet(schedules, approvedSwaps, currentUser.id, currentUser.team_id);
  }, [schedules, approvedSwaps, currentUser.id, currentUser.team_id]);

  // Escala efetiva do alvo selecionado
  const targetEffectiveDates = useMemo(() => {
    if (!selectedTarget) return new Set<string>();
    const targetGuard = availableGuards.find(g => g.id === selectedTarget);
    if (!targetGuard?.team_id) return new Set<string>();
    return getEffectiveDatesSet(schedules, approvedSwaps, targetGuard.id, targetGuard.team_id);
  }, [schedules, approvedSwaps, selectedTarget, availableGuards]);

  const getTeamForDate = (date: Date): TeamSchedule | undefined => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return schedules.find(s => s.shift_date === dateStr);
  };

  // Verifica se a data é do solicitante (para o calendário "Data do Seu Plantão")
  const isRequesterDate = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return myEffectiveDates.has(dateStr);
  };

  // Verifica se a data é do alvo (para o calendário "Data do Plantão que Quer Assumir")
  const isTargetDate = (date: Date): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return targetEffectiveDates.has(dateStr);
  };

  const getTeamColor = (teamId: string): string => {
    const team = schedules.find(s => s.team_id === teamId)?.team;
    if (!team) return '';
    
    // Extrair apenas a parte de cor de fundo
    const colorConfig = team.name === 'Equipe A' ? 'bg-blue-500' :
                       team.name === 'Equipe B' ? 'bg-green-500' :
                       team.name === 'Equipe C' ? 'bg-yellow-500' :
                       team.name === 'Equipe D' ? 'bg-purple-500' : '';
    return colorConfig;
  };

  const validateSwapDates = (requesterDate: Date, targetDate: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date('2027-12-31');
    
    if (requesterDate <= today) {
      toast({
        title: 'Data inválida',
        description: 'A data do seu plantão deve ser posterior ao dia atual.',
        variant: 'destructive',
      });
      return false;
    }

    if (targetDate <= today) {
      toast({
        title: 'Data inválida',
        description: 'A data do plantão que você quer assumir deve ser posterior ao dia atual.',
        variant: 'destructive',
      });
      return false;
    }

    if (requesterDate > maxDate || targetDate > maxDate) {
      toast({
        title: 'Data inválida',
        description: 'Ambas as datas devem ser até 31/12/2027.',
        variant: 'destructive',
      });
      return false;
    }

    if (format(requesterDate, 'yyyy-MM-dd') === format(targetDate, 'yyyy-MM-dd')) {
      toast({
        title: 'Data inválida',
        description: 'As datas dos plantões devem ser diferentes.',
        variant: 'destructive',
      });
      return false;
    }

    if (settings.swap_same_month_only) {
      if (requesterDate.getMonth() !== targetDate.getMonth() || requesterDate.getFullYear() !== targetDate.getFullYear()) {
        toast({
          title: 'Troca não permitida',
          description: 'As trocas só são permitidas dentro do mesmo mês.',
          variant: 'destructive',
        });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTarget || !requesterShiftDate || !targetShiftDate || !reason.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Todos os campos são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (!validateSwapDates(requesterShiftDate, targetShiftDate)) {
      return;
    }

    setLoading(true);

    try {
      const requesterDateStr = format(requesterShiftDate, 'yyyy-MM-dd');
      const targetDateStr = format(targetShiftDate, 'yyyy-MM-dd');

      const { data: swapData, error } = await supabase
        .from('swap_requests')
        .insert([
          {
            requester_id: currentUser.id,
            target_id: selectedTarget,
            requester_shift_date: requesterDateStr,
            target_shift_date: targetDateStr,
            reason: reason.trim(),
            status: 'PENDING',
            admin_id: currentUser.admin_id
          }
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23514') {
          toast({
            title: 'Erro de validação',
            description: 'Não é possível solicitar troca consigo mesmo.',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      // Buscar dados do target para webhook
      const targetGuard = availableGuards.find(g => g.id === selectedTarget);

      // Verificar autenticação antes de enviar webhook
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 [GuardSwapForm][Webhook] Auth check:', session ? 'Autenticado' : 'Não autenticado');

      if (!session) {
        console.error('⚠️ [GuardSwapForm][Webhook] Sessão não encontrada - webhook não será enviado');
        toast({
          title: '⚠️ Aviso de autenticação',
          description: 'A solicitação foi criada, mas a notificação pode ter falhado. Você pode precisar fazer login novamente.',
          variant: 'default'
        });
      }

      // Enviar webhook notificando a criação da solicitação
      if (session) {
        try {
          const webhookPayload = {
            evento: 'troca_solicitada',
            aprovacao_chefe_estado: 'pendente',
            requester_name: currentUser.name,
            requester_email: currentUser.email,
            requester_phone: currentUser.phone || '',
            target_name: targetGuard?.name || '',
            target_email: targetGuard?.email || '',
            target_phone: targetGuard?.phone || '',
            requester_shift_date: requesterDateStr,
            target_shift_date: targetDateStr,
            reason: reason.trim(),
            status: 'PENDING',
            created_at: swapData.created_at,
            admin_approved: false,
          };

          console.log('📤 [GuardSwapForm][Webhook] Enviando payload de criação:', JSON.stringify(webhookPayload, null, 2));

          const { data: webhookData, error: webhookError } = await supabase.functions.invoke('send-swap-webhook', {
            body: webhookPayload
          });

          if (webhookError) {
            console.error('⚠️ [GuardSwapForm][Webhook] Erro ao enviar webhook:', {
              message: webhookError.message,
              details: webhookError
            });
            toast({
              title: '⚠️ Webhook não enviado',
              description: 'A solicitação foi criada com sucesso, mas a notificação externa falhou.',
              variant: 'default'
            });
          } else {
            console.log('✅ [GuardSwapForm][Webhook] Webhook enviado com sucesso:', webhookData);
          }
        } catch (webhookError: any) {
          console.error('⚠️ [GuardSwapForm][Webhook] Exceção ao enviar webhook:', {
            message: webhookError?.message || 'Erro desconhecido',
            error: webhookError
          });
          toast({
            title: '⚠️ Webhook não enviado',
            description: 'A solicitação foi criada, mas houve um erro ao enviar a notificação.',
            variant: 'default'
          });
        }
      }

      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action: 'SWAP_REQUEST_CREATED',
        entity_type: 'swap_request',
        details: {
          target_id: selectedTarget,
          requester_shift_date: requesterDateStr,
          target_shift_date: targetDateStr
        }
      });

      toast({
        title: 'Solicitação enviada',
        description: 'Sua solicitação de troca foi enviada com sucesso e aparecerá como pendente em suas solicitações.',
      });

      setSelectedTarget('');
      setRequesterShiftDate(undefined);
      setTargetShiftDate(undefined);
      setReason('');
      
      // Notify parent to refresh the list
      if (onSwapCreated) {
        onSwapCreated();
      }
      
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('[GuardSwapForm][Submit]', error);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar a solicitação de troca.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedGuard = availableGuards.find(guard => guard.id === selectedTarget);
  
  const requesterTeamSchedule = requesterShiftDate ? getTeamForDate(requesterShiftDate) : undefined;
  const targetTeamSchedule = targetShiftDate ? getTeamForDate(targetShiftDate) : undefined;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const maxDateObj = new Date('2027-12-31');

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Solicitar Troca de Plantão
        </CardTitle>
        <CardDescription>
          Preencha os dados para solicitar uma troca de plantão com outro segurança.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current User Info */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground mb-1">Solicitante</div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{currentUser.name}</span>
              {currentUser.team && <TeamBadge team={currentUser.team} />}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{currentUser.email}</div>
          </div>

          {/* Target Guard Selection */}
          <div className="space-y-2">
            <Label htmlFor="target">Membro para Troca *</Label>
            <Select value={selectedTarget} onValueChange={setSelectedTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o membro para a troca" />
              </SelectTrigger>
              <SelectContent>
                {availableGuards.map((guard) => (
                  <SelectItem key={guard.id} value={guard.id}>
                    <div className="flex items-center gap-2">
                      <span>{guard.name}</span>
                      {guard.team && <span className="text-xs text-muted-foreground">({guard.team.name})</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableGuards.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum segurança disponível para troca no momento.
              </p>
            )}
          </div>

          {/* Selected Target Preview */}
          {selectedGuard && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Membro Selecionado</div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{selectedGuard.name}</span>
                {selectedGuard.team && <TeamBadge team={selectedGuard.team} />}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{selectedGuard.email}</div>
            </div>
          )}

          {/* Requester Shift Date */}
          <div className="space-y-2">
            <Label>Data do Seu Plantão (que você quer trocar) *</Label>
            <Popover open={requesterCalendarOpen} onOpenChange={setRequesterCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !requesterShiftDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {requesterShiftDate ? format(requesterShiftDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={requesterShiftDate}
                  onSelect={(date) => {
                    setRequesterShiftDate(date);
                    setRequesterCalendarOpen(false);
                    // Clear target date if it's now outside the allowed month
                    if (settings.swap_same_month_only && date && targetShiftDate) {
                      if (date.getMonth() !== targetShiftDate.getMonth() || date.getFullYear() !== targetShiftDate.getFullYear()) {
                        setTargetShiftDate(undefined);
                      }
                    }
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (date <= today || date > maxDateObj) return true;
                    return !isRequesterDate(date);
                  }}
                  modifiers={{
                    userTeam: (date) => {
                      return isRequesterDate(date);
                    }
                  }}
                  modifiersStyles={{
                    userTeam: {
                      fontWeight: 'bold',
                      backgroundColor: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary-foreground))',
                      borderRadius: '0.375rem'
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {requesterTeamSchedule && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-muted/50 rounded">
                <span className="text-xs">Plantão da equipe:</span>
                {requesterTeamSchedule.team && <TeamBadge team={requesterTeamSchedule.team} />}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Data do plantão que você atualmente tem e deseja trocar. Apenas datas da sua equipe estão disponíveis.
            </p>
          </div>

          {/* Target Shift Date */}
          <div className="space-y-2">
            <Label>Data do Plantão que Você Quer Assumir *</Label>
            <Popover open={targetCalendarOpen} onOpenChange={setTargetCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !targetShiftDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetShiftDate ? format(targetShiftDate, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targetShiftDate}
                  onSelect={(date) => {
                    setTargetShiftDate(date);
                    setTargetCalendarOpen(false);
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (date <= today || date > maxDateObj) return true;
                    if (settings.swap_same_month_only && requesterShiftDate) {
                      if (date.getMonth() !== requesterShiftDate.getMonth() || date.getFullYear() !== requesterShiftDate.getFullYear()) {
                        return true;
                      }
                    }
                    return !isTargetDate(date);
                  }}
                  modifiers={{
                    userTeam: (date) => {
                      return isRequesterDate(date);
                    },
                    targetTeam: (date) => {
                      return isTargetDate(date);
                    }
                  }}
                  modifiersStyles={{
                    userTeam: {
                      fontWeight: 'bold',
                      backgroundColor: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary-foreground))',
                      borderRadius: '0.375rem'
                    },
                    targetTeam: {
                      fontWeight: '600',
                      backgroundColor: 'hsl(142 76% 36%)',
                      color: 'white',
                      borderRadius: '0.375rem'
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {targetTeamSchedule && (
              <div className="flex items-center gap-2 mt-2 p-2 bg-muted/50 rounded">
                <span className="text-xs">Plantão da equipe:</span>
                {targetTeamSchedule.team && <TeamBadge team={targetTeamSchedule.team} />}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Data do plantão que você deseja assumir. Selecione primeiro o membro para ver as datas disponíveis da equipe dele.
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da Troca *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explique o motivo da solicitação de troca..."
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              Descreva claramente o motivo da troca para facilitar a análise.
            </p>
          </div>

          {/* Schedule Note */}
          <div className="p-4 bg-info/10 border border-info/20 rounded-lg">
            <div className="flex items-start gap-2">
              <CalendarDays className="h-4 w-4 text-info mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-info mb-1">Importante sobre o regime 24/72</div>
                <p className="text-muted-foreground">
                  As trocas devem respeitar o sistema de escalas 24/72. 
                  A solicitação será analisada considerando a compatibilidade com os horários estabelecidos.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading || !selectedTarget || !requesterShiftDate || !targetShiftDate || !reason.trim()}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Enviando...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Enviar Solicitação
                </>
              )}
            </Button>
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}