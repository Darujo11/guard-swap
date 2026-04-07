import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Team } from "@/lib/types";
import { format, addDays, addMonths, subMonths, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2, Palette } from "lucide-react";

interface TeamSchedule {
  id: string;
  team_id: string;
  shift_date: string;
  team?: Team;
}

interface Profile {
  id: string;
  name: string;
  team_id: string | null;
}

interface TeamScheduleCalendarProps {
  readOnly?: boolean;
}

export function TeamScheduleCalendar({ readOnly = false }: TeamScheduleCalendarProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [schedules, setSchedules] = useState<TeamSchedule[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const { toast } = useToast();
  const { profile, loading: authLoading } = useAuth();

  const getAdminId = () => {
    if (!profile) return null;
    return profile.admin_id || profile.id;
  };

  useEffect(() => {
    if (authLoading || !profile) return;
    fetchTeams();
    fetchProfiles();
  }, [authLoading, profile?.id]);

  useEffect(() => {
    if (authLoading || !profile) return;
    setCalendarLoading(true);
    fetchSchedules().finally(() => setCalendarLoading(false));
  }, [currentMonth, authLoading, profile?.id, profile?.admin_id]);

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
    const adminId = getAdminId();

    let query = supabase
      .from("team_schedules")
      .select(`
        *,
        team:teams(*)
      `)
      .gte("shift_date", format(start, "yyyy-MM-dd"))
      .lte("shift_date", format(end, "yyyy-MM-dd"));

    if (adminId) {
      query = query.eq("admin_id", adminId);
    }

    const { data, error } = await query;

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

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, team_id")
      .order("name");

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar integrantes",
        description: error.message,
      });
      return;
    }

    setProfiles(data || []);
  };

  const getTeamMembers = (teamId: string): Profile[] => {
    return profiles.filter(p => p.team_id === teamId);
  };

  const getTeamForDate = (date: Date): Team | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const schedule = schedules.find(s => s.shift_date === dateStr);
    return schedule?.team || null;
  };

  const getTeamColorStyle = (color: string): React.CSSProperties => {
    return {
      backgroundColor: color + '20', // 20 = 12.5% opacity in hex
      borderColor: color,
      color: color,
    };
  };

  const getTeamShortLabel = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    return last.charAt(0).toUpperCase();
  };

  const handleDateClick = async (date: Date) => {
    if (readOnly) return; // Don't allow edits in read-only mode
    
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
    
    // Check if the SELECTED team already has a schedule on this date
    const existingSchedule = schedules.find(s => s.shift_date === dateStr && s.team_id === selectedTeam);
    
    // Check if ANY other team has a schedule on this date
    const otherTeamSchedule = schedules.find(s => s.shift_date === dateStr && s.team_id !== selectedTeam);

    if (existingSchedule) {
      // Remove schedule for the selected team
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
      // If another team has this date, remove it first
      if (otherTeamSchedule) {
        await supabase
          .from("team_schedules")
          .delete()
          .eq("id", otherTeamSchedule.id);
      }
      
      // Add schedule for the selected team
      const adminId = getAdminId();
      const { error } = await supabase
        .from("team_schedules")
        .insert({
          team_id: selectedTeam,
          shift_date: dateStr,
          admin_id: adminId,
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
    // Sort teams by name to get A, B, C, D order
    const sortedTeams = [...teams]
      .filter(t => t.name.match(/^Equipe\s+[A-Da-d]$/i))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (sortedTeams.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhuma equipe disponível",
        description: "Por favor, crie equipes (Equipe A, B, C, D) antes de gerar o padrão.",
      });
      return;
    }

    setLoading(true);

    const start = startOfMonth(currentMonth);
    const end = addDays(endOfMonth(currentMonth), 365);
    const adminId = getAdminId();

    // Delete existing schedules in the period
    await supabase
      .from("team_schedules")
      .delete()
      .gte("shift_date", format(start, "yyyy-MM-dd"))
      .lte("shift_date", format(end, "yyyy-MM-dd"));

    // Use fixed anchor: Jan 1, 2026 = Team A (index 0)
    const anchor = new Date(2026, 0, 1); // 2026-01-01
    const schedulesToInsert: { team_id: string; shift_date: string; admin_id: string | null }[] = [];
    
    let currentDate = start;
    while (currentDate <= end) {
      const daysSinceAnchor = Math.floor((currentDate.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const teamIndex = ((daysSinceAnchor % sortedTeams.length) + sortedTeams.length) % sortedTeams.length;
      
      schedulesToInsert.push({
        team_id: sortedTeams[teamIndex].id,
        shift_date: format(currentDate, "yyyy-MM-dd"),
        admin_id: adminId,
      });

      currentDate = addDays(currentDate, 1);
    }

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
      description: `Padrão gerado para todas as equipes até ${format(end, "dd/MM/yyyy")}`,
    });

    setLoading(false);
    fetchSchedules();
  };

  const updateTeamColor = async (teamId: string, color: string) => {
    const { error } = await supabase
      .from("teams")
      .update({ color })
      .eq("id", teamId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar cor",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Cor atualizada",
      description: "A cor da equipe foi atualizada com sucesso.",
    });

    fetchTeams();
  };

  const renderDay = (date: Date) => {
    const team = getTeamForDate(date);
    
    return (
      <div
        onClick={() => !readOnly && handleDateClick(date)}
        style={team ? getTeamColorStyle(team.color || '#3b82f6') : {}}
        className={`
          relative w-full h-full min-h-[50px] md:min-h-[60px] p-1 md:p-2 ${!readOnly ? 'cursor-pointer' : ''}
          border rounded md:border-2 md:rounded-md
          ${!readOnly ? 'hover:ring-1 md:hover:ring-2 hover:ring-primary' : ''}
          transition-all
          ${!team ? 'bg-background border-border' : ''}
        `}
      >
        <div className="text-xs md:text-sm font-medium">
          {format(date, "d")}
        </div>
        {team && (
          <div className="text-[0.65rem] md:text-xs mt-0.5 md:mt-1 font-medium truncate leading-tight">
            <span className="md:hidden">{getTeamShortLabel(team.name)}</span>
            <span className="hidden md:inline">{team.name}</span>
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
      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {/* Week days header */}
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day, idx) => (
          <div key={day} className="text-center text-xs md:text-sm font-medium text-muted-foreground p-1 md:p-2">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{["D", "S", "T", "Q", "Q", "S", "S"][idx]}</span>
          </div>
        ))}
        
        {/* Padding days */}
        {paddingDays.map((_, idx) => (
          <div key={`padding-${idx}`} className="min-h-[50px] md:min-h-[60px]" />
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
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-base md:text-lg font-semibold min-w-[180px] md:min-w-[200px] text-center capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {!readOnly && (
              <div className="flex flex-col gap-2">
                <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                  <SelectTrigger className="w-full">
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
                  disabled={loading}
                  className="w-full"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Gerar Padrão 24/72 para Todas</span>
                  <span className="sm:hidden">Gerar Padrão 24/72</span>
                </Button>
              </div>
            )}
          </div>

          {/* Calendar */}
          {renderCalendar()}

          {/* Legend with team members */}
          <div className="space-y-3">
            <h3 className="text-xs md:text-sm font-medium">Equipes e Integrantes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {teams.map((team) => {
                const members = getTeamMembers(team.id);
                return (
                  <Card key={team.id} className="overflow-hidden">
                    <CardContent className="p-3 md:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 md:w-4 md:h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: team.color || '#3b82f6' }}
                          />
                          <span className="font-medium text-sm md:text-base">{team.name}</span>
                        </div>
                        {!readOnly && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                              >
                                <Palette className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">Editar cor de {team.name}</h4>
                                <div className="flex gap-2">
                                  <Input
                                    type="color"
                                    value={team.color || '#3b82f6'}
                                    onChange={(e) => updateTeamColor(team.id, e.target.value)}
                                    className="w-20 h-10 cursor-pointer"
                                  />
                                  <Input
                                    type="text"
                                    value={team.color || '#3b82f6'}
                                    onChange={(e) => updateTeamColor(team.id, e.target.value)}
                                    placeholder="#3b82f6"
                                    className="flex-1"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Escolha uma cor para {team.name}
                                </p>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                      
                      {members.length > 0 ? (
                        <div className="space-y-1">
                          {members.map((member) => (
                            <div
                              key={member.id}
                              className="text-xs md:text-sm text-muted-foreground pl-5 md:pl-6"
                            >
                              • {member.name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground pl-5 md:pl-6">
                          Nenhum integrante nesta equipe
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}