import { TeamScheduleCalendar } from "@/components/schedule/TeamScheduleCalendar";
import { AppLayout } from "@/components/layout/AppLayout";

export default function AdminSchedule() {
  return (
    <AppLayout title="Calendário de Escalas">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Calendário de Escalas</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie as escalas das equipes. Clique em um dia para atribuir ou remover uma equipe.
          </p>
        </div>

        <TeamScheduleCalendar />
      </div>
    </AppLayout>
  );
}