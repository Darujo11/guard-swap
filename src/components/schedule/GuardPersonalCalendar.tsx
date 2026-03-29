import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, ArrowRightLeft, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GuardPersonalCalendarProps {
  guardId: string;
  teamId: string | null;
  teamColor: string;
  teamName: string;
}

interface WorkingDay {
  date: string;
  teamColor: string;
  teamName: string;
  isSwapped: boolean;
}

export function GuardPersonalCalendar({ guardId, teamId, teamColor, teamName }: GuardPersonalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [teamSchedules, setTeamSchedules] = useState<any[]>([]);
  const [swapRequests, setSwapRequests] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (teamId) {
      fetchData();
    }
  }, [teamId, guardId, currentMonth]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

      const [schedulesRes, swapsRes, teamsRes] = await Promise.all([
        // Buscar escalas do meu time neste mês
        supabase
          .from('team_schedules')
          .select('*')
          .eq('team_id', teamId!)
          .gte('shift_date', monthStart)
          .lte('shift_date', monthEnd),
        // Buscar trocas aprovadas onde sou requester ou target
        supabase
          .from('swap_requests')
          .select(`
            *,
            requester:profiles!swap_requests_requester_id_fkey(id, name, team_id),
            target:profiles!swap_requests_target_id_fkey(id, name, team_id)
          `)
          .eq('status', 'APPROVED')
          .or(`requester_id.eq.${guardId},target_id.eq.${guardId}`),
        // Buscar todas as equipes para pegar cores
        supabase.from('teams').select('id, name, color'),
      ]);

      if (schedulesRes.error) throw schedulesRes.error;
      if (swapsRes.error) throw swapsRes.error;

      setTeamSchedules(schedulesRes.data || []);
      setSwapRequests(swapsRes.data || []);
      setAllTeams(teamsRes.data || []);
    } catch (error) {
      console.error('[GuardPersonalCalendar] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const workingDays = useMemo(() => {
    const days = new Map<string, WorkingDay>();

    // 1. Adicionar dias base da minha equipe
    teamSchedules.forEach(schedule => {
      days.set(schedule.shift_date, {
        date: schedule.shift_date,
        teamColor,
        teamName,
        isSwapped: false,
      });
    });

    // 2. Aplicar trocas aprovadas
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    swapRequests.forEach(swap => {
      const isRequester = swap.requester_id === guardId;
      const isTarget = swap.target_id === guardId;

      if (isRequester) {
        days.delete(swap.requester_shift_date);
        const targetDate = new Date(`${swap.target_shift_date}T00:00:00`);
        if (targetDate >= monthStart && targetDate <= monthEnd) {
          // Usar cor/nome da equipe do TARGET (outro segurança)
          const otherTeam = allTeams.find(t => t.id === swap.target?.team_id);
          days.set(swap.target_shift_date, {
            date: swap.target_shift_date,
            teamColor: otherTeam?.color || teamColor,
            teamName: otherTeam?.name || teamName,
            isSwapped: true,
          });
        }
      } else if (isTarget) {
        days.delete(swap.target_shift_date);
        const requesterDate = new Date(`${swap.requester_shift_date}T00:00:00`);
        if (requesterDate >= monthStart && requesterDate <= monthEnd) {
          // Usar cor/nome da equipe do REQUESTER (outro segurança)
          const otherTeam = allTeams.find(t => t.id === swap.requester?.team_id);
          days.set(swap.requester_shift_date, {
            date: swap.requester_shift_date,
            teamColor: otherTeam?.color || teamColor,
            teamName: otherTeam?.name || teamName,
            isSwapped: true,
          });
        }
      }
    });

    return days;
  }, [teamSchedules, swapRequests, allTeams, guardId, teamId, teamColor, teamName, currentMonth]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const swappedCount = useMemo(() => {
    return Array.from(workingDays.values()).filter(d => d.isSwapped).length;
  }, [workingDays]);

  // Legenda dinâmica: todas as equipes que aparecem no calendário
  const legendTeams = useMemo(() => {
    const teamsMap = new Map<string, { color: string; name: string }>();
    // Sempre incluir a equipe do segurança
    teamsMap.set(teamName, { color: teamColor, name: teamName });
    workingDays.forEach(day => {
      if (!teamsMap.has(day.teamName)) {
        teamsMap.set(day.teamName, { color: day.teamColor, name: day.teamName });
      }
    });
    return Array.from(teamsMap.values());
  }, [workingDays, teamColor, teamName]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Minha Escala</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Legenda dinâmica */}
        <div className="flex flex-wrap gap-3 mt-2 text-xs">
          {legendTeams.map(team => (
            <div key={team.name} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: team.color }} />
              <span className="text-muted-foreground">{team.name}</span>
            </div>
          ))}
          {swappedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Troca ({swappedCount})</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">Total: {workingDays.size} plantões</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Header dias da semana */}
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
            {/* Dias do calendário */}
            {calendarDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const workDay = workingDays.get(dateStr);
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);

               return (
                <div
                  key={dateStr}
                  className={`
                    relative flex flex-col items-center justify-center h-12 rounded-md text-xs transition-colors
                    ${!inMonth ? 'opacity-30' : ''}
                    ${today ? 'ring-2 ring-primary ring-offset-1' : ''}
                    ${workDay ? 'text-white font-semibold' : 'text-foreground'}
                  `}
                  style={workDay ? { backgroundColor: workDay.teamColor } : undefined}
                  title={workDay ? `${workDay.teamName}${workDay.isSwapped ? ' (troca)' : ''}` : undefined}
                >
                  <span className="text-sm">{format(day, 'd')}</span>
                  {workDay && (
                    <span className="text-[8px] leading-tight text-white/80 truncate max-w-full px-0.5">
                      {workDay.teamName}
                    </span>
                  )}
                  {workDay?.isSwapped && (
                    <ArrowRightLeft className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-white/80" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
