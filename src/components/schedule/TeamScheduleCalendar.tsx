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
import { format, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
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
  const { toast } = useToast();
  const { profile } = useAuth();

  useEffect(() => {
    fetchTeams();
    fetchProfiles();
    if (profile?.id) {
      fetchSchedules();
    }
  }, [currentMonth, profile?.id]);

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

    if (!profile?.admin_id) return;

    const { data, error } = await supabase
      .from("team_schedules")
      .select(`
        *,
        team:teams(*)
      `)
      .gte("shift_date", format(start, "yyyy-MM-dd"))
      .lte("shift_date", format(end, "yyyy-MM-dd"))
      .eq("admin_id", profile.admin_id);

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
    if (!profile?.admin_id) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, team_id")
      .eq("admin_id", profile.admin_id)
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
      backgroundColor: color + '15', // 15 = ~8% opacity in hex for soft pastel background
      borderColor: color,
      borderWidth: '2px',
    };
  };

  const getTeamTextColor = (color: string): string => {
    // Return the team color for text
    return color;
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
    const existingSchedule = schedules.find(s => s.shift_date === dateStr);

    if (existingSchedule) {
      // Se a escala existente é da mesma equipe selecionada, remove
      if (existingSchedule.team_id === selectedTeam) {
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
        // Se é de outra equipe, substitui
        const { error } = await supabase
          .from("team_schedules")
          .update({ team_id: selectedTeam })
          .eq("id", existingSchedule.id);

        if (error) {
          toast({
            variant: "destructive",
            title: "Erro ao atualizar escala",
            description: error.message,
          });
          return;
        }

        const newTeam = teams.find(t => t.id === selectedTeam);
        toast({
          title: "Escala atualizada",
          description: `${format(date, "dd/MM/yyyy")} agora está com ${newTeam?.name}`,
        });
      }
    } else {
      // Adiciona nova escala
      const { error } = await supabase
        .from("team_schedules")
        .insert({
          team_id: selectedTeam,
          shift_date: dateStr,
          admin_id: profile?.id as string,
        });

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao adicionar escala",
          description: error.message,
        });
        return;
      }

      const newTeam = teams.find(t => t.id === selectedTeam);
      toast({
        title: "Escala adicionada",
        description: `${newTeam?.name} foi atribuída para ${format(date, "dd/MM/yyyy")}`,
      });
    }

    fetchSchedules();
  };

  const generatePattern24_72 = async () => {
    if (teams.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhuma equipe disponível",
        description: "Por favor, crie equipes antes de gerar o padrão.",
      });
      return;
    }

    setLoading(true);

    const start = startOfMonth(currentMonth);
    const end = addDays(endOfMonth(currentMonth), 365); // Generate for next year

    // Delete existing schedules in the period
    await supabase
      .from("team_schedules")
      .delete()
      .gte("shift_date", format(start, "yyyy-MM-dd"))
      .lte("shift_date", format(end, "yyyy-MM-dd"))
      .eq("admin_id", profile?.id as string);

    // Generate pattern for all teams with offset
    const schedulesToInsert = [];
    
    teams.forEach((team, teamIndex) => {
      let currentDate = addDays(start, teamIndex); // Offset each team by 1 day
      let isWorkDay = true;
      let consecutiveDays = 0;

      while (currentDate <= end) {
        if (isWorkDay) {
          schedulesToInsert.push({
            team_id: team.id,
            shift_date: format(currentDate, "yyyy-MM-dd"),
            admin_id: profile?.id as string,
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
    });

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
    const teamColor = team?.color || '#3b82f6';
    
    return (
      <div
        onClick={() => !readOnly && handleDateClick(date)}
        style={team ? getTeamColorStyle(teamColor) : {}}
        className={`
          relative w-full h-full min-h-[70px] md:min-h-[80px] p-2 md:p-3 ${!readOnly ? 'cursor-pointer' : ''}
          border-2 rounded-lg
          ${!readOnly ? 'hover:shadow-md' : ''}
          transition-all duration-200
          ${!team ? 'bg-background border-border hover:border-primary/30' : ''}
          flex flex-col items-start justify-start gap-1
        `}
      >
        <div 
          className="text-base md:text-lg font-bold"
          style={{ color: team ? teamColor : 'inherit' }}
        >
          {format(date, "d")}
        </div>
        {team && (
          <div 
            className="text-xs md:text-sm font-medium leading-tight"
            style={{ color: teamColor }}
          >
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
      <div className="grid grid-cols-7 gap-2 md:gap-3">
        {/* Week days header */}
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div key={day} className="text-center text-sm md:text-base font-semibold text-muted-foreground p-2">
            {day}
          </div>
        ))}
        
        {/* Padding days */}
        {paddingDays.map((_, idx) => (
          <div key={`padding-${idx}`} className="min-h-[70px] md:min-h-[80px]" />
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
                onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-base md:text-lg font-semibold min-w-[180px] md:min-w-[200px] text-center capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
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
          <div className="space-y-4 mt-8">
            <h3 className="text-base md:text-lg font-semibold">Equipes e Integrantes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((team) => {
                const members = getTeamMembers(team.id);
                return (
                  <Card key={team.id} className="overflow-hidden border-2">
                    <CardContent className="p-4 md:p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-5 h-5 md:w-6 md:h-6 rounded-full flex-shrink-0"
                            style={{ backgroundColor: team.color || '#3b82f6' }}
                          />
                          <span className="font-semibold text-base md:text-lg">{team.name}</span>
                        </div>
                        {!readOnly && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <Palette className="h-4 w-4" />
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
                        <div className="space-y-1.5 ml-1">
                          {members.map((member) => (
                            <div
                              key={member.id}
                              className="text-sm text-muted-foreground flex items-start gap-2"
                            >
                              <span className="text-muted-foreground/50 mt-0.5">•</span>
                              <span>{member.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground ml-1">
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