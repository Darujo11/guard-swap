import { TeamScheduleCalendar } from "@/components/schedule/TeamScheduleCalendar";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  const [isDeleting, setIsDeleting] = useState(false);

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
      // Refresh the page to show empty calendar
      window.location.reload();
    } catch (error) {
      console.error('Erro ao limpar escalas:', error);
      toast.error('Erro ao limpar as escalas');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AppLayout 
      title="Calendário de Escalas" 
      user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}
    >
      <div className="container mx-auto p-3 md:p-6 max-w-7xl">
        <div className="mb-4 md:mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Calendário de Escalas</h1>
            <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
              Gerencie as escalas das equipes. Clique em um dia para atribuir ou remover uma equipe.
            </p>
          </div>
          
          {role === 'super_admin' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Limpar Todas as Escalas
            </Button>
          )}
        </div>

        <TeamScheduleCalendar />
      </div>

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