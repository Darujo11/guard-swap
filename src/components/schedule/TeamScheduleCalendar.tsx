import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Team } from "@/lib/types";
import { TEAM_COLORS } from "@/lib/constants";
import { format, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

interface TeamSchedule {
  id: string;
  team_id: string;
  shift_date: string;
  team?: Team;
}

export function TeamScheduleCalendar() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [schedules, setSchedules] = useState<TeamSchedule[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeams();
    fetchSchedules();
  }, [currentMonth]);

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("name");

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar equipes",
        description: error.message,
      });
      return;
    }

    setTeams(data || []);
  };

  const fetchSchedules = async () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    const { data, error } = await supabase
      .from("team_schedules")
      .select(`
        *,
        team:teams(*)
      `)
      .gte("shift_date", format(start, "yyyy-MM-dd"))
      .lte("shift_date", format(end, "yyyy-MM-dd"));

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar escalas",
        description: error.message,
      });
      return;
    }

    setSchedules(data || []);
  };

  const getTeamForDate = (date: Date): Team | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const schedule = schedules.find(s => s.shift_date === dateStr);
    return schedule?.team || null;
  };

  const getTeamColor = (teamName: string): string => {
    const config = TEAM_COLORS.find(t => t.name === teamName);
    return config?.color || "bg-gray-100 text-gray-800";
  };

  const handleDateClick = async (date: Date) => {
    if (!selectedTeam) {
      toast({
        variant: "destructive",
        title: "Selecione uma equipe",
        description: "Por favor, selecione uma equipe antes de marcar um dia.",
      });
      return;
    }

    setSelectedDate(date);
    const dateStr = format(date, "yyyy-MM-dd");
    const existingSchedule = schedules.find(s => s.shift_date === dateStr);

    if (existingSchedule) {
      // Remove schedule
      const { error } = await supabase
        .from("team_schedules")
        .delete()
        .eq("id", existingSchedule.id);

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao remover escala",
          description: error.message,
        });
        return;
      }

      toast({
        title: "Escala removida",
        description: `A escala foi removida de ${format(date, "dd/MM/yyyy")}`,
      });
    } else {
      // Add schedule
      const { error } = await supabase
        .from("team_schedules")
        .insert({
          team_id: selectedTeam,
          shift_date: dateStr,
        });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao adicionar escala",
          description: error.message,
        });
        return;
      }

      toast({
        title: "Escala adicionada",
        description: `A escala foi adicionada para ${format(date, "dd/MM/yyyy")}`,
      });
    }

    fetchSchedules();
  };

  const generatePattern24_72 = async () => {
    if (!selectedTeam) {
      toast({
        variant: "destructive",
        title: "Selecione uma equipe",
        description: "Por favor, selecione uma equipe para gerar o padrão.",
      });
      return;
    }

    setLoading(true);

    const team = teams.find(t => t.id === selectedTeam);
    const start = startOfMonth(currentMonth);
    const end = addDays(endOfMonth(currentMonth), 365); // Generate for next year

    // Pattern: 1 day work, 3 days off (24/72)
    const schedulesToInsert = [];
    let currentDate = start;
    let isWorkDay = true;
    let consecutiveDays = 0;

    while (currentDate <= end) {
      if (isWorkDay) {
        schedulesToInsert.push({
          team_id: selectedTeam,
          shift_date: format(currentDate, "yyyy-MM-dd"),
        });
        consecutiveDays++;
        if (consecutiveDays >= 1) {
          isWorkDay = false;
          consecutiveDays = 0;
        }
      } else {
        consecutiveDays++;
        if (consecutiveDays >= 3) {
          isWorkDay = true;
          consecutiveDays = 0;
        }
      }
      currentDate = addDays(currentDate, 1);
    }

    // Delete existing schedules for this team in the period
    await supabase
      .from("team_schedules")
      .delete()
      .eq("team_id", selectedTeam)
      .gte("shift_date", format(start, "yyyy-MM-dd"))
      .lte("shift_date", format(end, "yyyy-MM-dd"));

    // Insert new schedules in batches
    const batchSize = 100;
    for (let i = 0; i < schedulesToInsert.length; i += batchSize) {
      const batch = schedulesToInsert.slice(i, i + batchSize);
      const { error } = await supabase
        .from("team_schedules")
        .insert(batch);

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao gerar padrão",
          description: error.message,
        });
        setLoading(false);
        return;
      }
    }

    toast({
      title: "Padrão 24/72 gerado",
      description: `Padrão gerado para ${team?.name} até ${format(end, "dd/MM/yyyy")}`,
    });

    setLoading(false);
    fetchSchedules();
  };

  const renderDay = (date: Date) => {
    const team = getTeamForDate(date);
    
    return (
      <div
        onClick={() => handleDateClick(date)}
        className={`
          relative w-full h-full min-h-[60px] p-2 cursor-pointer
          border border-border rounded-md
          hover:ring-2 hover:ring-primary
          transition-all
          ${team ? getTeamColor(team.name) : 'bg-background'}
        `}
      >
        <div className="text-sm font-medium">
          {format(date, "d")}
        </div>
        {team && (
          <div className="text-xs mt-1 font-medium truncate">
            {team.name}
          </div>
        )}
      </div>
    );
  };

  const renderCalendar = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    // Get first day of month and pad with previous month days
    const firstDayOfWeek = start.getDay();
    const paddingDays = Array(firstDayOfWeek).fill(null);

    return (
      <div className="grid grid-cols-7 gap-2">
        {/* Week days header */}
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
            {day}
          </div>
        ))}
        
        {/* Padding days */}
        {paddingDays.map((_, idx) => (
          <div key={`padding-${idx}`} className="min-h-[60px]" />
        ))}
        
        {/* Calendar days */}
        {days.map((day) => (
          <div key={day.toISOString()}>
            {renderDay(day)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendário de Escalas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-lg font-semibold min-w-[200px] text-center">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Selecione uma equipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={generatePattern24_72}
                disabled={!selectedTeam || loading}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Gerar Padrão 24/72
              </Button>
            </div>
          </div>

          {/* Calendar */}
          {renderCalendar()}

          {/* Legend */}
          <div className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <Badge
                key={team.id}
                variant="secondary"
                className={getTeamColor(team.name)}
              >
                {team.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}