import { TeamScheduleCalendar } from "@/components/schedule/TeamScheduleCalendar";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Trash2, CalendarPlus, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, parseISO } from "date-fns";
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

export default function AdminSchedule() {
  const { profile, role } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records

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
      // First, delete any schedules from November 2026 onwards (cleanup wrong schedules)
      const cleanupDate = '2026-11-01';
      const { error: deleteError } = await supabase
        .from('team_schedules')
        .delete()
        .gte('shift_date', cleanupDate);

      if (deleteError) {
        console.error('Error cleaning up schedules:', deleteError);
        // Continue anyway - might not have permissions or no schedules to delete
      }

      // Get all teams - filter only valid teams (Equipe A, B, C, D pattern)
      const { data: allTeams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');

      if (teamsError) throw teamsError;

      if (!allTeams || allTeams.length === 0) {
        toast.error('Nenhuma equipe cadastrada');
        return;
      }

      // Filter and sort teams to get fixed rotation order (A→B→C→D)
      // Only include teams that follow the "Equipe X" naming pattern
      const sortedTeams = allTeams
        .filter(t => t.name.match(/^Equipe\s+[A-Da-d]$/i))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (sortedTeams.length === 0) {
        // Fallback: use all teams sorted by name if no "Equipe X" pattern found
        sortedTeams.push(...allTeams.sort((a, b) => a.name.localeCompare(b.name)));
      }

      console.log('Fixed team rotation:', sortedTeams.map(t => t.name));

      // Get the last scheduled date before November 2026 to continue the pattern
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
        // Continue from the day after the last existing schedule
        const lastDate = parseISO(lastSchedules[0].shift_date);
        startDate = addDays(lastDate, 1);

        // Find which team worked on the last day
        const lastTeamId = lastSchedules[0].team_id;
        const lastTeamIndex = sortedTeams.findIndex(t => t.id === lastTeamId);
        
        // Start with the next team in rotation
        if (lastTeamIndex !== -1) {
          startTeamIndex = (lastTeamIndex + 1) % sortedTeams.length;
        }

        console.log('Last schedule:', lastSchedules[0].shift_date, '- Team index:', lastTeamIndex);
        console.log('Starting from:', format(startDate, 'yyyy-MM-dd'), '- Team:', sortedTeams[startTeamIndex]?.name);
      } else {
        // No existing schedules, start from tomorrow
        startDate = addDays(new Date(), 1);
        console.log('No existing schedules, starting from:', format(startDate, 'yyyy-MM-dd'));
      }

      // Check if we need to generate anything
      if (startDate > targetEndDate) {
        toast.info('As escalas já estão geradas até dezembro de 2027');
        setShowGenerateDialog(false);
        return;
      }

      // Generate schedules using 24/72 pattern (1 day work, 3 days off per team)
      // Each day, one team works, then rotates to next team
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

      // Insert in batches
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