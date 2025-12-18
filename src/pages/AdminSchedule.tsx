import { TeamScheduleCalendar } from "@/components/schedule/TeamScheduleCalendar";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Trash2, CalendarPlus, Loader2, Calendar as CalendarIcon, Send } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

export default function AdminSchedule() {
  const { profile, role, user } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [extraDate, setExtraDate] = useState<Date | undefined>(undefined);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<string>('');

  const handleClearAllSchedules = async () => {
    if (role !== 'super_admin') {
      toast.error('Apenas super admin pode limpar todas as escalas');
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('team_schedules')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;

      toast.success('Todas as escalas foram limpas com sucesso');
      setShowDeleteDialog(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Erro ao limpar escalas:', error);
      toast.error('Erro ao limpar as escalas');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateFutureSchedules = async () => {
    setIsGenerating(true);
    try {
      const cleanupDate = '2026-11-01';
      const { error: deleteError } = await supabase
        .from('team_schedules')
        .delete()
        .gte('shift_date', cleanupDate);

      if (deleteError) {
        console.error('Error cleaning up schedules:', deleteError);
      }

      const { data: allTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      if (teamsError) throw teamsError;

      if (!allTeams || allTeams.length === 0) {
        toast.error('Nenhuma equipe cadastrada');
        return;
      }

      const sortedTeams = allTeams
        .filter(t => t.name.match(/^Equipe\s+[A-Da-d]$/i))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (sortedTeams.length === 0) {
        sortedTeams.push(...allTeams.sort((a, b) => a.name.localeCompare(b.name)));
      }

      console.log('Fixed team rotation:', sortedTeams.map(t => t.name));

      const { data: lastSchedules, error: lastError } = await supabase
        .from('team_schedules')
        .select('shift_date, team_id')
        .lt('shift_date', cleanupDate)
        .order('shift_date', { ascending: false })
        .limit(1);

      if (lastError) throw lastError;

      const targetEndDate = new Date('2027-12-31');
      let startDate: Date;
      let startTeamIndex = 0;

      if (lastSchedules && lastSchedules.length > 0) {
        const lastDate = parseISO(lastSchedules[0].shift_date);
        startDate = addDays(lastDate, 1);

        const lastTeamId = lastSchedules[0].team_id;
        const lastTeamIndex = sortedTeams.findIndex(t => t.id === lastTeamId);
        
        if (lastTeamIndex !== -1) {
          startTeamIndex = (lastTeamIndex + 1) % sortedTeams.length;
        }

        console.log('Last schedule:', lastSchedules[0].shift_date, '- Team index:', lastTeamIndex);
        console.log('Starting from:', format(startDate, 'yyyy-MM-dd'), '- Team:', sortedTeams[startTeamIndex]?.name);
      } else {
        startDate = addDays(new Date(), 1);
        console.log('No existing schedules, starting from:', format(startDate, 'yyyy-MM-dd'));
      }

      if (startDate > targetEndDate) {
        toast.info('As escalas já estão geradas até dezembro de 2027');
        setShowGenerateDialog(false);
        return;
      }

      const schedulesToInsert: { team_id: string; shift_date: string; admin_id: string | null }[] = [];
      let currentDate = startDate;
      let teamIndex = startTeamIndex;
      const adminId = profile?.admin_id || profile?.id || null;

      while (currentDate <= targetEndDate) {
        const currentTeam = sortedTeams[teamIndex % sortedTeams.length];
        
        schedulesToInsert.push({
          team_id: currentTeam.id,
          shift_date: format(currentDate, 'yyyy-MM-dd'),
          admin_id: adminId,
        });

        teamIndex++;
        currentDate = addDays(currentDate, 1);
      }

      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < schedulesToInsert.length; i += batchSize) {
        const batch = schedulesToInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from('team_schedules')
          .insert(batch);

        if (error) throw error;
        insertedCount += batch.length;
      }

      toast.success(`${insertedCount} escalas geradas até 31/12/2027`);
      setShowGenerateDialog(false);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Erro ao gerar escalas:', error);
      toast.error('Erro ao gerar as escalas futuras');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendWebhook = async () => {
    if (!extraDate || !user) return;
    
    setIsSendingWebhook(true);
    
    try {
      const formattedDate = format(extraDate, 'yyyy-MM-dd');
      
      // 1. Buscar escala das equipes a partir da data de referência
      const { data: schedules, error: schedulesError } = await supabase
        .from('team_schedules')
        .select(`
          shift_date,
          teams (name, color)
        `)
        .gte('shift_date', formattedDate)
        .order('shift_date', { ascending: true });
      
      if (schedulesError) throw schedulesError;

      // 2. Buscar trocas futuras
      const { data: swaps, error: swapsError } = await supabase
        .from('swap_requests')
        .select(`
          *,
          requester:profiles!requester_id(name, phone),
          target:profiles!target_id(name, phone)
        `)
        .or(`requester_shift_date.gte.${formattedDate},target_shift_date.gte.${formattedDate}`);
      
      if (swapsError) throw swapsError;

      // 3. Buscar extras e calcular ranking
      const { data: extras, error: extrasError } = await supabase
        .from('extras')
        .select(`
          guard_id,
          quantity,
          percentage_type,
          profiles!guard_id(name, phone)
        `);
      
      if (extrasError) throw extrasError;

      // 4. Buscar folgas
      const { data: leaves, error: leavesError } = await supabase
        .from('leaves')
        .select(`
          *,
          profiles!guard_id(name, phone)
        `);
      
      if (leavesError) throw leavesError;

      // 5. Buscar equipes com integrantes
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          color,
          profiles!team_id(id, name, phone, email, is_shift_chief, is_active)
        `)
        .order('name');
      
      if (teamsError) throw teamsError;

      // 6. Buscar escalas dos próximos 2 meses para escala individual
      const hoje = new Date();
      const dataLimite = new Date(hoje);
      dataLimite.setMonth(dataLimite.getMonth() + 2);
      const hojeFormatado = format(hoje, 'yyyy-MM-dd');
      const dataLimiteFormatada = format(dataLimite, 'yyyy-MM-dd');

      const { data: escalasProximas, error: escalasProximasError } = await supabase
        .from('team_schedules')
        .select('shift_date, team_id')
        .gte('shift_date', hojeFormatado)
        .lte('shift_date', dataLimiteFormatada)
        .order('shift_date', { ascending: true });
      
      if (escalasProximasError) throw escalasProximasError;

      // 7. Buscar todos os seguranças com suas equipes
      const { data: guardas, error: guardasError } = await supabase
        .from('profiles')
        .select('id, name, phone, email, team_id, is_shift_chief, is_active')
        .not('team_id', 'is', null);
      
      if (guardasError) throw guardasError;

      // 8. Buscar nome do admin
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      // Processar equipes com integrantes
      const equipesComIntegrantes = teams?.map(team => ({
        id: team.id,
        nome: team.name,
        cor: team.color,
        integrantes: ((team as any).profiles as any[])?.map(member => ({
          id: member.id,
          nome: member.name,
          telefone: member.phone,
          email: member.email,
          chefe_de_plantao: member.is_shift_chief,
          ativo: member.is_active
        })) || []
      })) || [];

      // Criar mapa de escalas por team_id
      const escalasPorEquipe = new Map<string, string[]>();
      escalasProximas?.forEach(e => {
        const datas = escalasPorEquipe.get(e.team_id) || [];
        datas.push(e.shift_date);
        escalasPorEquipe.set(e.team_id, datas);
      });

      // Processar escala individual de cada segurança
      const escalaIndividualSegurancas = guardas?.map(guarda => ({
        id: guarda.id,
        nome: guarda.name,
        telefone: guarda.phone,
        email: guarda.email,
        chefe_de_plantao: guarda.is_shift_chief,
        ativo: guarda.is_active,
        equipe_id: guarda.team_id,
        dias_de_plantao: escalasPorEquipe.get(guarda.team_id!) || []
      })) || [];

      // Processar escala das equipes
      const escalaEquipes = schedules?.map(s => ({
        data: s.shift_date,
        equipe: (s.teams as any)?.name,
        cor: (s.teams as any)?.color
      })) || [];

      // Processar ranking de extras
      const extrasMap = new Map<string, {
        seguranca: string;
        telefone: string | null;
        total_horas: number;
        total_extras_50: number;
        total_extras_100: number;
      }>();
      
      extras?.forEach(e => {
        const guardId = e.guard_id;
        const current = extrasMap.get(guardId) || {
          seguranca: (e.profiles as any)?.name || '',
          telefone: (e.profiles as any)?.phone || null,
          total_horas: 0,
          total_extras_50: 0,
          total_extras_100: 0
        };
        current.total_horas += e.quantity;
        if (e.percentage_type === 50) {
          current.total_extras_50 += e.quantity;
        } else {
          current.total_extras_100 += e.quantity;
        }
        extrasMap.set(guardId, current);
      });

      const rankingExtras = Array.from(extrasMap.values())
        .sort((a, b) => b.total_horas - a.total_horas)
        .map((item, index) => ({ posicao: index + 1, ...item }));

      // Montar payload
      const payload = {
        data_referencia: formattedDate,
        equipes_com_integrantes: equipesComIntegrantes,
        escala_individual_segurancas: escalaIndividualSegurancas,
        escala_equipes: escalaEquipes,
        trocas_futuras: swaps?.map(s => ({
          id: s.id,
          solicitante: (s.requester as any)?.name,
          solicitante_telefone: (s.requester as any)?.phone,
          alvo: (s.target as any)?.name,
          alvo_telefone: (s.target as any)?.phone,
          data_plantao_solicitante: s.requester_shift_date,
          data_plantao_alvo: s.target_shift_date,
          status: s.status,
          motivo: s.reason,
          confirmacao_alvo: s.target_confirmation,
          aprovado_admin: s.admin_approved
        })) || [],
        ranking_extras: rankingExtras,
        folgas_registradas: leaves?.map(l => ({
          id: l.id,
          seguranca: (l.profiles as any)?.name,
          telefone: (l.profiles as any)?.phone,
          tipo: l.leave_type,
          tipo_customizado: l.custom_type,
          data_inicio: l.start_date,
          data_fim: l.end_date,
          observacoes: l.notes
        })) || [],
        enviado_em: new Date().toISOString(),
        enviado_por: adminProfile?.name || 'Admin'
      };

      // Enviar para webhook
      const response = await fetch(
        'https://n8n.autozapx.com/webhook-test/3c9e14cf-191b-49c7-bed0-36b2936e1a7d',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      // Capturar resposta do webhook
      const responseData = await response.text();
      try {
        const jsonResponse = JSON.parse(responseData);
        setWebhookResponse(JSON.stringify(jsonResponse, null, 2));
      } catch {
        setWebhookResponse(responseData || 'Resposta vazia');
      }

      toast.success('Dados enviados com sucesso!', {
        description: 'Escala, trocas, ranking e folgas enviados para automação.'
      });

    } catch (error: any) {
      console.error('Erro ao enviar webhook:', error);
      toast.error('Erro ao enviar dados', {
        description: error.message
      });
    } finally {
      setIsSendingWebhook(false);
    }
  };

  return (
    <AppLayout 
      title="Calendário de Escalas" 
      user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}
    >
      <div className="container mx-auto p-3 md:p-6 max-w-7xl">
        <div className="mb-4 md:mb-6 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">Calendário de Escalas</h1>
            <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
              Gerencie as escalas das equipes. Clique em um dia para atribuir ou remover uma equipe.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            {(role === 'admin' || role === 'super_admin') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGenerateDialog(true)}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <CalendarPlus className="h-4 w-4" />
                <span>Gerar Escalas até 2027</span>
              </Button>
            )}
            
            {role === 'super_admin' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sm:inline">Limpar Todas</span>
              </Button>
            )}
          </div>
        </div>

        <TeamScheduleCalendar key={refreshKey} />

        {/* Seção de Envio de Dados para Webhook */}
        {(role === 'admin' || role === 'super_admin') && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Enviar Dados para Automação
              </CardTitle>
              <CardDescription>
                Selecione uma data de referência para enviar escala das equipes, trocas futuras, ranking de extras e folgas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Data de Referência</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {extraDate ? format(extraDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={extraDate}
                        onSelect={setExtraDate}
                        locale={ptBR}
                        disabled={(date) => date < new Date()}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <Button 
                  onClick={handleSendWebhook}
                  disabled={!extraDate || isSendingWebhook}
                  className="flex items-center gap-2"
                >
                  {isSendingWebhook ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Enviar Dados
                    </>
                  )}
                </Button>
              </div>

              {/* Campo de resposta do webhook */}
              {webhookResponse && (
                <div className="mt-4">
                  <label className="text-sm font-medium">Resposta da Automação</label>
                  <Textarea
                    value={webhookResponse}
                    readOnly
                    className="mt-2 font-mono text-sm min-h-[150px] bg-muted"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setWebhookResponse('')}
                  >
                    Limpar resposta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog para gerar escalas */}
      <AlertDialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar escalas futuras</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá gerar escalas automaticamente até <strong>31 de dezembro de 2027</strong>, 
              continuando o padrão de rotação das equipes existente. As escalas já cadastradas não serão alteradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGenerating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerateFutureSchedules}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                'Gerar Escalas'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para limpar escalas */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar limpeza de todas as escalas</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover <strong>TODAS</strong> as escalas de <strong>TODOS</strong> os usuários do sistema.
              Esta ação não pode ser desfeita. Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllSchedules}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Limpando...' : 'Sim, limpar tudo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
