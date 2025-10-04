import { TeamScheduleCalendar } from "@/components/schedule/TeamScheduleCalendar";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";

export default function AdminSchedule() {
  const { profile } = useAuth();

  return (
    <AppLayout 
      title="Calendário de Escalas" 
      user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}
    >
      <div className="container mx-auto p-3 md:p-6 max-w-7xl">
        <div className="mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Calendário de Escalas</h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base">
            Gerencie as escalas das equipes. Clique em um dia para atribuir ou remover uma equipe.
          </p>
        </div>

        <TeamScheduleCalendar />
      </div>
    </AppLayout>
  );
}