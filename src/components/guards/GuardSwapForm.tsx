import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamBadge } from '@/components/ui/team-badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/lib/types';
import { CalendarDays, Users, ArrowRightLeft } from 'lucide-react';

interface GuardSwapFormProps {
  currentUser: Profile;
  onClose?: () => void;
}

export function GuardSwapForm({ currentUser, onClose }: GuardSwapFormProps) {
  const [availableGuards, setAvailableGuards] = useState<Profile[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [swapDate, setSwapDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAvailableGuards();
  }, [currentUser]);

  const fetchAvailableGuards = async () => {
    try {
      // Fetch guards from different teams only
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          team:teams(*)
        `)
        .neq('id', currentUser.id)
        .neq('team_id', currentUser.team_id || 'null');

      if (error) throw error;

      setAvailableGuards((data || []) as Profile[]);
    } catch (error) {
      console.error('[GuardSwapForm][FetchGuards]', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os guardas disponíveis.',
        variant: 'destructive',
      });
    }
  };

  const validateSwapDate = (date: string): boolean => {
    const swapDate = new Date(date);
    const today = new Date();
    const maxDate = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());
    
    // Must be in the future
    if (swapDate <= today) {
      toast({
        title: 'Data inválida',
        description: 'A data da troca deve ser posterior ao dia atual.',
        variant: 'destructive',
      });
      return false;
    }

    // Must be within 2 months
    if (swapDate > maxDate) {
      toast({
        title: 'Data inválida',
        description: 'A data da troca deve ser dentro de 2 meses.',
        variant: 'destructive',
      });
      return false;
    }

    // Must respect 24/72 schedule (simplified validation)
    // In a real system, this would check against the actual shift schedule
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTarget || !swapDate || !reason.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Todos os campos são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (!validateSwapDate(swapDate)) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('swap_requests')
        .insert([
          {
            requester_id: currentUser.id,
            target_id: selectedTarget,
            swap_date: swapDate,
            reason: reason.trim(),
            status: 'PENDING'
          }
        ]);

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

      // Create audit log
      await supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        action: 'SWAP_REQUEST_CREATED',
        entity_type: 'swap_request',
        details: {
          target_id: selectedTarget,
          swap_date: swapDate
        }
      });

      toast({
        title: 'Solicitação enviada',
        description: 'Sua solicitação de troca foi enviada com sucesso. O membro convidado receberá uma notificação.',
      });

      // Reset form
      setSelectedTarget('');
      setSwapDate('');
      setReason('');
      
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

  // Get minimum date (tomorrow) and maximum date (2 months from now)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  const maxDateObj = new Date();
  maxDateObj.setMonth(maxDateObj.getMonth() + 2);
  const maxDate = maxDateObj.toISOString().split('T')[0];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Solicitar Troca de Plantão
        </CardTitle>
        <CardDescription>
          Preencha os dados para solicitar uma troca de plantão com outro membro de equipe diferente.
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
                {availableGuards.length === 0 ? (
                  <SelectItem value="" disabled>
                    Nenhum guarda disponível
                  </SelectItem>
                ) : (
                  availableGuards.map((guard) => (
                    <SelectItem key={guard.id} value={guard.id}>
                      <div className="flex items-center gap-2">
                        <span>{guard.name}</span>
                        {guard.team && <span className="text-xs text-muted-foreground">({guard.team.name})</span>}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {availableGuards.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Não há guardas de outras equipes disponíveis no momento.
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

          {/* Swap Date */}
          <div className="space-y-2">
            <Label htmlFor="swapDate">Data da Troca *</Label>
            <Input
              id="swapDate"
              type="date"
              value={swapDate}
              onChange={(e) => setSwapDate(e.target.value)}
              min={minDate}
              max={maxDate}
              required
            />
            <p className="text-xs text-muted-foreground">
              A data deve estar entre amanhã e {maxDateObj.toLocaleDateString('pt-BR')}.
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
              disabled={loading || !selectedTarget || !swapDate || !reason.trim()}
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