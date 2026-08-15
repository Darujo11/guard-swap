import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, ArrowRightLeft, Calendar as CalendarIcon, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { computeEffectiveSchedule, EffectiveDay } from '@/utils/effectiveSchedule';
import { generateGuardSchedulePDF, GuardScheduleReport } from '@/utils/schedulePdf';

const getLeaveLabel = (leaveType: string, customType?: string | null): string => {
  switch (leaveType) {
    case 'TRE': return 'TRE';
    case 'ATESTADO': return 'Atestado';
    case 'FERIAS': return 'Férias';
    case 'LICENCA_NOJO': return 'Lic. Nojo';
    case 'LICENCA_PATERNIDADE': return 'Lic. Pat.';
    case 'LICENCA_NAO_REMUNERADA': return 'Lic. N/R';
    case 'FALTA_INJUSTIFICADA': return 'Falta';
    default: return customType || 'Afastamento';
  }
};

interface GuardPersonalCalendarProps {
  guardId: string;
  teamId: string | null;
  teamColor: string;
  teamName: string;
  guardName?: string;
  selectionMode?: boolean;
  selectedDate?: string | null;
  onDateSelect?: (date: string) => void;
  /** Título do card. Padrão: "Minha Escala". */
  title?: string;
  /** Exibe o painel com as trocas do mês (protocolo, colega e datas). */
  showSwapDetails?: boolean;
}

interface WorkingDay extends EffectiveDay {}

export function GuardPersonalCalendar({ guardId, teamId, teamColor, teamName, guardName, selectionMode, selectedDate, onDateSelect, title = 'Minha Escala', showSwapDetails = false }: GuardPersonalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [teamSchedules, setTeamSchedules] = useState<any[]>([]);
  const [swapRequests, setSwapRequests] = useState<any[]>([]);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [leaveDates, setLeaveDates] = useState<Map<string, string>>(new Map());
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

      const [schedulesRes, swapsRes, teamsRes, extrasRes, treLeavesRes] = await Promise.all([
        supabase
          .from('team_schedules')
          .select('*')
          .eq('team_id', teamId!)
          .gte('shift_date', monthStart)
          .lte('shift_date', monthEnd),
        supabase
          .from('swap_requests')
          .select(`
            *,
            requester:profiles!swap_requests_requester_id_fkey(id, name, team_id),
            target:profiles!swap_requests_target_id_fkey(id, name, team_id)
          `)
          .eq('status', 'APPROVED')
          .or(`requester_id.eq.${guardId},target_id.eq.${guardId}`),
        supabase.from('teams').select('id, name, color'),
        supabase
          .from('extras')
          .select('*')
          .eq('guard_id', guardId)
          .gte('extra_date', monthStart)
          .lte('extra_date', monthEnd),
        // Buscar todos os afastamentos aprovados que intersectem o mês
        supabase
          .from('leaves')
          .select('start_date, end_date, leave_type, custom_type')
          .eq('guard_id', guardId)
          .eq('status', 'APPROVED')
          .lte('start_date', monthEnd)
          .gte('end_date', monthStart),
      ]);

      if (schedulesRes.error) throw schedulesRes.error;
      if (swapsRes.error) throw swapsRes.error;

      setTeamSchedules(schedulesRes.data || []);
      setSwapRequests(swapsRes.data || []);
      setAllTeams(teamsRes.data || []);
      setExtras(extrasRes.data || []);

      // Build leave dates map with type labels
      const leaveMap = new Map<string, string>();
      (treLeavesRes.data || []).forEach((l: any) => {
        const label = getLeaveLabel(l.leave_type, l.custom_type);
        let current = parseISO(l.start_date);
        const end = parseISO(l.end_date);
        while (current <= end) {
          const ds = format(current, 'yyyy-MM-dd');
          leaveMap.set(ds, label);
          current = addDays(current, 1);
        }
      });
      setLeaveDates(leaveMap);
    } catch (error) {
      console.error('[GuardPersonalCalendar] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const workingDays = useMemo(() => {
    const effectiveMap = computeEffectiveSchedule(
      teamSchedules,
      swapRequests,
      guardId,
      teamId || '',
      teamColor,
      teamName,
      allTeams
    );

    // Filtrar apenas dias do mês atual
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const filtered = new Map<string, WorkingDay>();

    effectiveMap.forEach((day, dateStr) => {
      const d = new Date(`${dateStr}T00:00:00`);
      if (d >= monthStart && d <= monthEnd) {
        filtered.set(dateStr, day);
      }
    });

    return filtered;
  }, [teamSchedules, swapRequests, allTeams, guardId, teamId, teamColor, teamName, currentMonth]);

  const extrasMap = useMemo(() => {
    const map = new Map<string, { justification: string; percentage_type: number }>();
    extras.forEach((e: any) => {
      map.set(e.extra_date, { justification: e.justification, percentage_type: e.percentage_type });
    });
    return map;
  }, [extras]);

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

  const givenAwayCount = useMemo(() => {
    return Array.from(workingDays.values()).filter(d => d.isGivenAway).length;
  }, [workingDays]);

  // Plantões efetivamente trabalhados: exclui dias cedidos e dias cobertos por afastamento.
  const workedCount = useMemo(() => {
    let count = 0;
    workingDays.forEach((day, dateStr) => {
      if (!day.isGivenAway && !leaveDates.has(dateStr)) count += 1;
    });
    return count;
  }, [workingDays, leaveDates]);

  // Trocas do mês consolidadas: um registro por solicitação (protocolo).
  const monthSwaps = useMemo(() => {
    const map = new Map<string, {
      protocol: string;
      counterpart: string;
      gave?: string;
      took?: string;
      coveredTeam?: string;
    }>();

    Array.from(workingDays.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(day => {
        if (!day.isSwapped && !day.isGivenAway) return;

        const key = day.swapId || day.date;
        const record = map.get(key) || {
          protocol: day.swapProtocol || '-',
          counterpart: (day.isGivenAway ? day.coveredByName : day.originalOwnerName) || 'N/A',
        };

        if (day.isGivenAway) {
          record.gave = day.date;
          record.took = record.took || day.exchangedForDate;
        } else {
          record.took = day.date;
          record.gave = record.gave || day.originalDate;
          record.coveredTeam = day.originalTeamName;
        }

        map.set(key, record);
      });

    return Array.from(map.values()).sort((a, b) => (a.gave || '').localeCompare(b.gave || ''));
  }, [workingDays]);

  const buildReport = (): GuardScheduleReport => {
    const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    return {
      guardName: guardName || 'Segurança',
      teamName,
      monthStart,
      monthLabel: format(currentMonth, 'MMMM yyyy', { locale: ptBR }),
      days: Array.from(workingDays.values()).map(day => ({
        date: day.date,
        teamName: day.teamName,
        isSwapped: day.isSwapped,
        isGivenAway: !!day.isGivenAway,
        counterpartName: day.isGivenAway ? day.coveredByName : day.originalOwnerName,
        counterpartTeamName: day.originalTeamName,
        exchangeDate: day.isGivenAway ? day.exchangedForDate : day.originalDate,
        swapProtocol: day.swapProtocol,
      })),
      extras: Array.from(extrasMap.entries()).map(([date, extra]) => ({
        date,
        justification: extra.justification,
        percentageType: extra.percentage_type,
      })),
      leaves: Array.from(leaveDates.entries())
        .filter(([date]) => date >= monthStart && date <= monthEnd)
        .map(([date, label]) => ({ date, label })),
    };
  };

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
            <CardTitle className="text-lg">{title}</CardTitle>
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
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Baixar PDF"
              onClick={() => generateGuardSchedulePDF(buildReport())}
            >
              <Download className="h-4 w-4" />
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
          {givenAwayCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#D1D5DB' }} />
              <span className="text-muted-foreground">Cedido ({givenAwayCount})</span>
            </div>
          )}
          {extrasMap.size > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#B8860B' }} />
              <span className="text-muted-foreground">Extra ({extrasMap.size})</span>
            </div>
          )}
          {leaveDates.size > 0 && (() => {
            const leaveTypes = new Map<string, number>();
            leaveDates.forEach(label => leaveTypes.set(label, (leaveTypes.get(label) || 0) + 1));
            return Array.from(leaveTypes.entries()).map(([label, count]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#DC2626' }} />
                <span className="text-muted-foreground">{label} ({count})</span>
              </div>
            ));
          })()}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground font-medium">Total: {workedCount} plantões trabalhados</span>
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
              const extraDay = extrasMap.get(dateStr);
              const leaveLabel = leaveDates.get(dateStr);

              // Não faz sentido pedir folga de um plantão que já foi cedido em troca,
              // nem de um dia já coberto por outro afastamento.
              const blockedForSelection = !!workDay?.isGivenAway || !!leaveLabel;
              const selectable = selectionMode && inMonth && !blockedForSelection;

               return (
                <div
                  key={dateStr}
                  onClick={() => selectable && onDateSelect?.(dateStr)}
                  className={`
                    relative flex flex-col items-center justify-center h-16 rounded-md text-xs transition-colors
                    ${!inMonth ? 'opacity-30' : ''}
                    ${today ? 'ring-2 ring-primary ring-offset-1' : ''}
                    ${selectionMode && selectedDate === dateStr ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}
                    ${selectable ? 'cursor-pointer hover:opacity-80' : ''}
                    ${selectionMode && inMonth && blockedForSelection ? 'cursor-not-allowed opacity-60' : ''}
                    ${leaveLabel || (workDay && !workDay.isGivenAway) || extraDay ? 'text-white font-semibold' : workDay?.isGivenAway ? 'text-gray-700 font-semibold' : 'text-foreground'}
                  `}
                  style={
                    leaveLabel
                      ? { backgroundColor: '#DC2626' }
                      : workDay?.isGivenAway
                        ? { backgroundColor: '#D1D5DB' }
                        : workDay && extraDay
                          ? { background: `linear-gradient(135deg, ${workDay.teamColor} 70%, #B8860B 30%)` }
                          : workDay
                            ? (workDay.isSwapped && workDay.originalTeamColor ? { background: `linear-gradient(135deg, ${workDay.teamColor} 90%, ${workDay.originalTeamColor} 10%)` } : { backgroundColor: workDay.teamColor })
                            : extraDay
                              ? { backgroundColor: '#B8860B' }
                              : undefined
                  }
                  title={
                    leaveLabel
                      ? leaveLabel
                      : workDay?.isGivenAway
                        ? `Cedido para ${workDay.coveredByName || ''}`
                        : workDay && extraDay
                          ? `${workDay.teamName} + Extra ${extraDay.percentage_type}%`
                          : workDay
                            ? `${workDay.teamName}${workDay.isSwapped ? ` (troca com ${workDay.originalOwnerName || ''})` : ''}`
                            : extraDay
                              ? `Extra ${extraDay.percentage_type}% — ${extraDay.justification}`
                              : undefined
                  }
                >
                  <span className="text-sm">{format(day, 'd')}</span>
                  {leaveLabel ? (
                    <span className="text-[8px] leading-tight text-white/90 font-bold">{leaveLabel}</span>
                  ) : workDay?.isGivenAway ? (
                    <span className="text-[8px] leading-tight text-gray-600 truncate max-w-full px-0.5">
                      {workDay.coveredByName?.split(' ')[0] || 'Cedido'}
                    </span>
                  ) : extraDay && !workDay ? (
                    <span className="text-[8px] leading-tight text-white/90 font-bold">Extra</span>
                  ) : workDay && workDay.isSwapped ? (
                    <>
                      <span className="text-[9px] leading-tight text-white/90 font-bold">
                        {workDay.originalTeamName ? workDay.originalTeamName.replace(/^Equipe\s*/i, '').charAt(0) : workDay.teamName.charAt(0)}
                      </span>
                      {workDay.originalOwnerName && (
                        <span className="text-[7px] leading-tight text-white/70 truncate max-w-full px-0.5">
                          {workDay.originalOwnerName.split(' ')[0]}
                        </span>
                      )}
                    </>
                  ) : workDay ? (
                    <span className="text-[8px] leading-tight text-white/80 truncate max-w-full px-0.5">
                      {workDay.teamName}
                    </span>
                  ) : null}
                  {workDay?.isSwapped && !leaveLabel && (
                    <ArrowRightLeft className="absolute top-0.5 right-0.5 h-2.5 w-2.5 text-white/80" />
                  )}
                  {extraDay && workDay && !leaveLabel && (
                    <span className="absolute bottom-0.5 right-0.5 text-[7px] text-yellow-200 font-bold">E</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showSwapDetails && !loading && monthSwaps.length > 0 && (
          <div className="mt-5 border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Trocas do mês ({monthSwaps.length})</h4>
            </div>
            <div className="space-y-2">
              {monthSwaps.map(swap => (
                <div
                  key={swap.protocol}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{swap.counterpart}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{swap.protocol}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="text-right">
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Cedeu</p>
                      <p className="font-medium">
                        {swap.gave ? format(parseISO(swap.gave), 'dd/MM', { locale: ptBR }) : '-'}
                      </p>
                    </div>
                    <ArrowRightLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Assumiu</p>
                      <p className="font-medium">
                        {swap.took ? format(parseISO(swap.took), 'dd/MM', { locale: ptBR }) : '-'}
                      </p>
                    </div>
                    {swap.coveredTeam && (
                      <Badge variant="outline" className="text-[10px]">
                        {swap.coveredTeam}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
