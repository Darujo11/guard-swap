import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, FileText, Trash2, Download, BarChart3, ChevronLeft, ChevronRight, Edit, ChevronUp, ChevronDown, ChevronsUpDown, Send, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Profile } from "@/lib/types";

// Helper functions for Brazilian holidays and weekend detection
const getBrazilianHolidays = (year: number): Date[] => {
  // Fixed holidays
  const fixedHolidays = [
    new Date(year, 0, 1),   // Confraternização Universal
    new Date(year, 3, 21),  // Tiradentes
    new Date(year, 4, 1),   // Dia do Trabalho
    new Date(year, 8, 7),   // Independência
    new Date(year, 9, 12),  // Nossa Senhora Aparecida
    new Date(year, 10, 2),  // Finados
    new Date(year, 10, 15), // Proclamação da República
    new Date(year, 11, 25), // Natal
  ];

  // Calculate Easter (Computus algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easter = new Date(year, month, day);

  // Movable holidays based on Easter
  const carnival1 = new Date(easter);
  carnival1.setDate(easter.getDate() - 48); // Segunda de Carnaval
  const carnival2 = new Date(easter);
  carnival2.setDate(easter.getDate() - 47); // Terça de Carnaval
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2); // Sexta-feira Santa
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60); // Corpus Christi

  return [...fixedHolidays, carnival1, carnival2, goodFriday, corpusChristi];
};

const isBrazilianHoliday = (date: Date): boolean => {
  const year = date.getFullYear();
  const holidays = getBrazilianHolidays(year);
  return holidays.some(holiday => 
    holiday.getDate() === date.getDate() && 
    holiday.getMonth() === date.getMonth() && 
    holiday.getFullYear() === date.getFullYear()
  );
};

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
};

const getPercentageTypeByDate = (date: Date): number => {
  if (isWeekend(date) || isBrazilianHoliday(date)) {
    return 100;
  }
  return 50;
};

interface Extra {
  id: string;
  guard_id: string;
  extra_date: string;
  month_reference: string;
  justification: string;
  quantity: number;
  minutes: number;
  percentage_type: number;
  created_at: string;
  guard?: Profile;
}

const formatHoursMinutes = (hours: number, minutes: number) => {
  if (minutes > 0) return `${hours}h${String(minutes).padStart(2, '0')}min`;
  return `${hours}h`;
};

const sumHoursMinutes = (items: { quantity: number; minutes: number }[]) => {
  let totalMinutes = items.reduce((sum, e) => sum + (Number(e.quantity) || 0) * 60 + (Number(e.minutes) || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return { hours, minutes: mins, totalMinutes };
};

export default function AdminExtras() {
  const navigate = useNavigate();
  const { user, role, profile, loading: authLoading } = useAuth();
  const [guards, setGuards] = useState<Profile[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [filteredExtras, setFilteredExtras] = useState<Extra[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(true);
  
  // Form state
  const [selectedGuard, setSelectedGuard] = useState<string>("");
  const [extraDate, setExtraDate] = useState<Date>();
  const [justification, setJustification] = useState("");
  const [quantity, setQuantity] = useState<number | undefined>(24);
  const [minutes, setMinutes] = useState<number>(0);
  const [percentageType, setPercentageType] = useState<number>(100);
  const [guardShiftDates, setGuardShiftDates] = useState<Date[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(new Date()));
  
  // Filter state
  const [filterMonth, setFilterMonth] = useState<Date>(new Date());
  
  // Ranking filter state
  const [rankingDate, setRankingDate] = useState<Date>(new Date());
  const [rankingAllMonths, setRankingAllMonths] = useState<boolean>(true);
  const [rankingPercentageFilter, setRankingPercentageFilter] = useState<'all' | '50' | '100'>('all');
  
  // Details filter state (separate from filterMonth)
  const [detailsMonth, setDetailsMonth] = useState<Date>(new Date());
  
  // Report percentage filter state
  const [reportPercentageFilter, setReportPercentageFilter] = useState<'all' | '50' | '100'>('all');
  const [reportAllMonths, setReportAllMonths] = useState<boolean>(false);
  const [reportSortOrder, setReportSortOrder] = useState<'alphabetical' | 'date'>('alphabetical');
  
  // Edit dialog state
  const [editingExtra, setEditingExtra] = useState<Extra | null>(null);
  const [editGuardId, setEditGuardId] = useState<string>("");
  const [editDate, setEditDate] = useState<Date>();
  const [editJustification, setEditJustification] = useState("");
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editMinutes, setEditMinutes] = useState<number>(0);
  const [editPercentageType, setEditPercentageType] = useState<number>(100);
  
  // Delete confirmation state
  const [deletingExtraId, setDeletingExtraId] = useState<string | null>(null);

  // Webhook state for "Preferência no Extra"
  const [preferenceDate, setPreferenceDate] = useState<Date | undefined>(undefined);
  const [isSendingWebhook, setIsSendingWebhook] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState<string>('');

  // Sorting state for details table
  const [detailsSortColumn, setDetailsSortColumn] = useState<'guardName' | 'quantity' | 'percentage_type' | 'extra_date' | null>(null);
  const [detailsSortDirection, setDetailsSortDirection] = useState<'asc' | 'desc'>('asc');

  // State for expanded ranking rows
  const [expandedGuards, setExpandedGuards] = useState<Set<string>>(new Set());

  const toggleGuardExpanded = (guardId: string) => {
    setExpandedGuards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(guardId)) {
        newSet.delete(guardId);
      } else {
        newSet.add(guardId);
      }
      return newSet;
    });
  };

  const getGuardExtrasDetails = (guardId: string) => {
    let baseExtras = extras.filter(e => e.guard_id === guardId);
    
    if (!rankingAllMonths) {
      const startDate = startOfMonth(rankingDate);
      const endDate = endOfMonth(rankingDate);
      baseExtras = baseExtras.filter((extra) => {
        const extraDate = new Date(`${extra.extra_date}T00:00:00`);
        return extraDate >= startDate && extraDate <= endDate;
      });
    }
    
    if (rankingPercentageFilter !== 'all') {
      baseExtras = baseExtras.filter(e => e.percentage_type === parseInt(rankingPercentageFilter));
    }
    
    return baseExtras.sort((a, b) => {
      const dateA = new Date(`${a.extra_date}T00:00:00`);
      const dateB = new Date(`${b.extra_date}T00:00:00`);
      return dateA.getTime() - dateB.getTime();
    });
  };

  const handleDetailsSort = (column: 'guardName' | 'quantity' | 'percentage_type' | 'extra_date') => {
    if (detailsSortColumn === column) {
      if (detailsSortDirection === 'asc') {
        setDetailsSortDirection('desc');
      } else {
        setDetailsSortColumn(null);
        setDetailsSortDirection('asc');
      }
    } else {
      setDetailsSortColumn(column);
      setDetailsSortDirection('asc');
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (role !== "admin") {
      navigate("/", { replace: true });
      return;
    }
    fetchGuards();
    fetchExtras();
  }, [role, authLoading, navigate]);

  useEffect(() => {
    applyFilters();
  }, [extras, filterMonth]);

  const monthlySummary = useMemo(() => {
    const summary = guards.map(guard => {
      const guardExtras = filteredExtras.filter(e => e.guard_id === guard.id);
      const totalHours = guardExtras.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      return {
        guardId: guard.id,
        guardName: guard.name,
        totalHours
      };
    });
    return summary.sort((a, b) => b.totalHours - a.totalHours);
  }, [guards, filteredExtras]);

  // Ranking for 50% extras
  const rankingSummary50 = useMemo(() => {
    const startDate = startOfMonth(rankingDate);
    const endDate = endOfMonth(rankingDate);

    const periodExtras = extras.filter((extra) => {
      const extraDate = new Date(`${extra.extra_date}T00:00:00`);
      return extraDate >= startDate && extraDate <= endDate && extra.percentage_type === 50;
    });

    const summary = guards.map(guard => {
      const guardExtras = periodExtras.filter(e => e.guard_id === guard.id);
      const totalHours = guardExtras.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      return {
        guardId: guard.id,
        guardName: guard.name,
        totalHours
      };
    });

    return {
      data: summary.filter(s => s.totalHours > 0).sort((a, b) => b.totalHours - a.totalHours),
      startDate,
      endDate
    };
  }, [guards, extras, rankingDate]);

  // Ranking for 100% extras
  const rankingSummary100 = useMemo(() => {
    const startDate = startOfMonth(rankingDate);
    const endDate = endOfMonth(rankingDate);

    const periodExtras = extras.filter((extra) => {
      const extraDate = new Date(`${extra.extra_date}T00:00:00`);
      return extraDate >= startDate && extraDate <= endDate && extra.percentage_type === 100;
    });

    const summary = guards.map(guard => {
      const guardExtras = periodExtras.filter(e => e.guard_id === guard.id);
      const totalHours = guardExtras.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      return {
        guardId: guard.id,
        guardName: guard.name,
        totalHours
      };
    });

    return {
      data: summary.filter(s => s.totalHours > 0).sort((a, b) => b.totalHours - a.totalHours),
      startDate,
      endDate
    };
  }, [guards, extras, rankingDate]);

  // Ranking filtrado com período e tipo de porcentagem
  const rankingFilteredSummary = useMemo(() => {
    let baseExtras = extras;
    
    // Filtrar por período
    if (!rankingAllMonths) {
      const startDate = startOfMonth(rankingDate);
      const endDate = endOfMonth(rankingDate);
      baseExtras = extras.filter((extra) => {
        const extraDate = new Date(`${extra.extra_date}T00:00:00`);
        return extraDate >= startDate && extraDate <= endDate;
      });
    }
    
    // Filtrar por tipo de porcentagem
    if (rankingPercentageFilter !== 'all') {
      baseExtras = baseExtras.filter(e => e.percentage_type === parseInt(rankingPercentageFilter));
    }
    
    // Calcular totais por guard
    const summary = guards.map(guard => {
      const guardExtras = baseExtras.filter(e => e.guard_id === guard.id);
      const { hours, minutes } = sumHoursMinutes(guardExtras);
      return {
        guardId: guard.id,
        guardName: guard.name,
        totalHours: hours,
        totalMinutes: minutes,
        totalInMinutes: hours * 60 + minutes,
      };
    });
    
    return summary.filter(s => s.totalInMinutes > 0).sort((a, b) => b.totalInMinutes - a.totalInMinutes);
  }, [guards, extras, rankingDate, rankingAllMonths, rankingPercentageFilter]);

  // Keep combined ranking for backward compatibility (PDF export, etc.)
  const rankingSummary = useMemo(() => {
    const startDate = startOfMonth(rankingDate);
    const endDate = endOfMonth(rankingDate);

    const periodExtras = extras.filter((extra) => {
      const extraDate = new Date(`${extra.extra_date}T00:00:00`);
      return extraDate >= startDate && extraDate <= endDate;
    });

    const summary = guards.map(guard => {
      const guardExtras = periodExtras.filter(e => e.guard_id === guard.id);
      const totalHours = guardExtras.reduce((sum, e) => sum + (Number(e.quantity) || 0), 0);
      return {
        guardId: guard.id,
        guardName: guard.name,
        totalHours
      };
    });

    return {
      data: summary.sort((a, b) => b.totalHours - a.totalHours),
      startDate,
      endDate
    };
  }, [guards, extras, rankingDate]);

  // Filtered extras for details section
  const detailsExtras = useMemo(() => {
    const startDate = startOfMonth(detailsMonth);
    const endDate = endOfMonth(detailsMonth);

    let filtered = extras.filter((extra) => {
      const extraDate = new Date(`${extra.extra_date}T00:00:00`);
      return extraDate >= startDate && extraDate <= endDate;
    });

    // Apply sorting
    if (detailsSortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0;
        
        if (detailsSortColumn === 'guardName') {
          const nameA = a.guard?.name || 'Desconhecido';
          const nameB = b.guard?.name || 'Desconhecido';
          comparison = nameA.localeCompare(nameB, 'pt-BR');
        } else if (detailsSortColumn === 'extra_date') {
          comparison = new Date(`${a.extra_date}T00:00:00`).getTime() - new Date(`${b.extra_date}T00:00:00`).getTime();
        } else if (detailsSortColumn === 'quantity') {
          comparison = (a.quantity || 0) - (b.quantity || 0);
        } else if (detailsSortColumn === 'percentage_type') {
          comparison = (a.percentage_type || 100) - (b.percentage_type || 100);
        }
        
        return detailsSortDirection === 'asc' ? comparison : -comparison;
      });
    } else {
      // Default sort by date if no column selected
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(`${a.extra_date}T00:00:00`);
        const dateB = new Date(`${b.extra_date}T00:00:00`);
        return dateA.getTime() - dateB.getTime();
      });
    }

    return filtered;
  }, [extras, detailsMonth, detailsSortColumn, detailsSortDirection]);

  // Filtered extras for report based on percentage type and period
  const reportFilteredExtras = useMemo(() => {
    let baseExtras = extras;
    
    // If not "all months", filter by selected month
    if (!reportAllMonths) {
      const targetKey = format(startOfMonth(filterMonth), "yyyy-MM");
      baseExtras = extras.filter((extra) => {
        const extraKey = format(new Date(`${extra.month_reference}T00:00:00`), "yyyy-MM");
        return extraKey === targetKey;
      });
    }
    
    // Filter by percentage type
    if (reportPercentageFilter !== 'all') {
      return baseExtras.filter(e => e.percentage_type === parseInt(reportPercentageFilter));
    }
    
    return baseExtras;
  }, [extras, filterMonth, reportAllMonths, reportPercentageFilter]);

  const fetchGuards = async () => {
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "guard");

    if (rolesError) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar seguranças",
        description: rolesError.message,
      });
      return;
    }

    const userIds = (rolesData || []).map((r: { user_id: string }) => r.user_id).filter(Boolean);

    if (!userIds.length) {
      setGuards([]);
      return;
    }

    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .in("user_id", userIds)
      .order("name");

    if (profilesError) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar seguranças",
        description: profilesError.message,
      });
      return;
    }

    setGuards(profilesData || []);
  };

  const fetchExtras = async () => {
    setExtrasLoading(true);

    const { data: extrasData, error: extrasError } = await supabase
      .from("extras")
      .select("*")
      .order("extra_date", { ascending: false });

    if (extrasError) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar extras",
        description: extrasError.message,
      });
      setExtrasLoading(false);
      return;
    }

    const extrasList = extrasData || [];

    const guardIds = Array.from(new Set(extrasList.map((e) => e.guard_id).filter(Boolean)));

    let profilesMap: Record<string, Profile> = {};
    if (guardIds.length) {
      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("*")
        .in("id", guardIds);

      if (profilesErr) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar perfis",
          description: profilesErr.message,
        });
      } else {
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p as Profile;
          return acc;
        }, {} as Record<string, Profile>);
      }
    }

    const withGuards: Extra[] = extrasList.map((e) => ({
      ...(e as any),
      quantity: (e as any).quantity ?? 1,
      minutes: (e as any).minutes ?? 0,
      percentage_type: (e as any).percentage_type ?? 100,
      guard: e.guard_id ? profilesMap[e.guard_id] : undefined,
    }));

    setExtras(withGuards);
    setExtrasLoading(false);
  };

  const fetchGuardShiftDates = async (guardId: string, month: Date = calendarMonth) => {
    if (!guardId) {
      setGuardShiftDates([]);
      return;
    }

    try {
      const { data: guardProfile, error: profileError } = await supabase
        .from("profiles")
        .select("team_id, name")
        .eq("id", guardId)
        .maybeSingle();

      if (profileError) {
        console.error("[fetchGuardShiftDates] Error fetching profile:", profileError);
        setGuardShiftDates([]);
        return;
      }

      if (!guardProfile?.team_id) {
        setGuardShiftDates([]);
        return;
      }

      const start = startOfMonth(month);
      const end = endOfMonth(month);

      const { data: schedules, error: schedulesError } = await supabase
        .from("team_schedules")
        .select("shift_date, team_id")
        .eq("team_id", guardProfile.team_id)
        .gte("shift_date", format(start, "yyyy-MM-dd"))
        .lte("shift_date", format(end, "yyyy-MM-dd"))
        .order("shift_date", { ascending: true });

      if (schedulesError) {
        console.error("[fetchGuardShiftDates] Error fetching schedules:", schedulesError);
        setGuardShiftDates([]);
        return;
      }

      if (!schedules || schedules.length === 0) {
        setGuardShiftDates([]);
        return;
      }

      const parseYmd = (ymd: string) => {
        const [y, m, d] = ymd.split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
      };

      const dates = schedules.map((s) => parseYmd(s.shift_date));
      setGuardShiftDates(dates);
    } catch (error) {
      console.error("[fetchGuardShiftDates] Unexpected error:", error);
      setGuardShiftDates([]);
    }
  };

  const applyFilters = () => {
    const targetKey = format(startOfMonth(filterMonth), "yyyy-MM");
    const filtered = extras.filter((extra) => {
      const extraKey = format(new Date(`${extra.month_reference}T00:00:00`), "yyyy-MM");
      return extraKey === targetKey;
    });

    const sorted = filtered.sort((a, b) => {
      const nameA = a.guard?.name || "Desconhecido";
      const nameB = b.guard?.name || "Desconhecido";
      return nameA.localeCompare(nameB, 'pt-BR');
    });

    setFilteredExtras(sorted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGuard) {
      toast({
        variant: "destructive",
        title: "Segurança não selecionado",
        description: "Por favor, selecione um segurança.",
      });
      return;
    }

    if (!extraDate) {
      toast({
        variant: "destructive",
        title: "Data não selecionada",
        description: "Por favor, selecione a data do extra.",
      });
      return;
    }

    if (!justification || justification.trim().length === 0) {
      toast({
        variant: "destructive",
        title: "Justificativa obrigatória",
        description: "Por favor, informe a fundamentação/justificativa.",
      });
      return;
    }

    if ((!quantity || quantity < 0) && (!minutes || minutes < 1)) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "As horas e/ou minutos devem ser maiores que zero.",
      });
      return;
    }

    if (!profile?.id) {
      toast({
        variant: "destructive",
        title: "Erro de autenticação",
        description: "Perfil do administrador não encontrado. Por favor, faça login novamente.",
      });
      return;
    }

    try {
      const extraDateFormatted = format(extraDate, "yyyy-MM-dd");

      // Check for duplicate: same guard + same date
      const { data: existingExtra, error: checkError } = await supabase
        .from("extras")
        .select("id, percentage_type")
        .eq("guard_id", selectedGuard)
        .eq("extra_date", extraDateFormatted)
        .eq("admin_id", profile.id)
        .maybeSingle();

      if (checkError) {
        console.error('[AdminExtras] Erro ao verificar duplicata:', checkError);
      }

      if (existingExtra) {
        toast({
          variant: "destructive",
          title: "Registro duplicado",
          description: `Já existe um extra cadastrado para este segurança em ${format(extraDate, "dd/MM/yyyy")} (${existingExtra.percentage_type}%). Edite o registro existente ou escolha outra data.`,
        });
        return;
      }

      const insertData = {
        guard_id: selectedGuard,
        extra_date: extraDateFormatted,
        month_reference: format(startOfMonth(extraDate), "yyyy-MM-dd"),
        justification: justification.trim(),
        quantity: quantity || 0,
        minutes: minutes || 0,
        percentage_type: percentageType,
        created_by: profile.id,
        admin_id: profile.id,
      };

      const { data, error } = await supabase.from("extras").insert(insertData).select();

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao cadastrar extra",
          description: error.message,
        });
        return;
      }

      toast({
        title: "Extra cadastrado",
        description: "Plantão extra registrado com sucesso.",
      });

      // Reset form
      setSelectedGuard("");
      setExtraDate(undefined);
      setJustification("");
      setQuantity(24);
      setMinutes(0);
      setPercentageType(100);
      setGuardShiftDates([]);
      
      fetchExtras();
    } catch (err) {
      console.error('[AdminExtras] Erro inesperado:', err);
      toast({
        variant: "destructive",
        title: "Erro inesperado",
        description: "Ocorreu um erro ao cadastrar o extra. Tente novamente.",
      });
    }
  };

  const openEditDialog = (extra: Extra) => {
    setEditingExtra(extra);
    setEditGuardId(extra.guard_id);
    setEditDate(new Date(`${extra.extra_date}T00:00:00`));
    setEditJustification(extra.justification);
    setEditQuantity(extra.quantity);
    setEditMinutes(extra.minutes || 0);
    setEditPercentageType(extra.percentage_type || 100);
  };

  const closeEditDialog = () => {
    setEditingExtra(null);
    setEditGuardId("");
    setEditDate(undefined);
    setEditJustification("");
    setEditQuantity(1);
    setEditMinutes(0);
    setEditPercentageType(100);
  };

  const handleUpdate = async () => {
    if (!editingExtra || !editGuardId || !editDate || !editJustification || (editQuantity < 1 && editMinutes < 1)) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos corretamente.",
      });
      return;
    }

    const editDateFormatted = format(editDate, "yyyy-MM-dd");

    // Check for duplicate: same guard + same date (excluding current record)
    const { data: existingExtra, error: checkError } = await supabase
      .from("extras")
      .select("id")
      .eq("guard_id", editGuardId)
      .eq("extra_date", editDateFormatted)
      .neq("id", editingExtra.id)
      .maybeSingle();

    if (checkError) {
      console.error('[AdminExtras] Erro ao verificar duplicata:', checkError);
    }

    if (existingExtra) {
      toast({
        variant: "destructive",
        title: "Registro duplicado",
        description: `Já existe outro extra cadastrado para este segurança em ${format(editDate, "dd/MM/yyyy")}. Escolha outra data.`,
      });
      return;
    }

    const { error } = await supabase
      .from("extras")
      .update({
        guard_id: editGuardId,
        extra_date: editDateFormatted,
        month_reference: format(startOfMonth(editDate), "yyyy-MM-dd"),
        justification: editJustification,
        quantity: editQuantity,
        minutes: editMinutes,
        percentage_type: editPercentageType,
      })
      .eq("id", editingExtra.id);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar extra",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Extra atualizado",
      description: "Registro atualizado com sucesso.",
    });

    closeEditDialog();
    fetchExtras();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingExtraId) return;

    const { error } = await supabase.from("extras").delete().eq("id", deletingExtraId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao excluir extra",
        description: error.message,
      });
      return;
    }

    toast({
      title: "Extra excluído",
      description: "Registro removido com sucesso.",
    });

    setDeletingExtraId(null);
    fetchExtras();
  };

  const generatePDF = () => {
    try {
      if (reportFilteredExtras.length === 0) {
        toast({
          variant: "destructive",
          title: "Sem dados",
          description: "Nenhum registro no período e tipo selecionado.",
        });
        return;
      }
      const doc = new jsPDF();
      
      // Dynamic title based on filter
      const filterLabel = reportPercentageFilter === 'all' 
        ? '' 
        : ` - ${reportPercentageFilter}%`;
      
      const periodLabel = reportAllMonths 
        ? 'Acumulado (Todos os Meses)' 
        : format(filterMonth, "MMMM 'de' yyyy", { locale: ptBR });
      
      doc.setFontSize(18);
      doc.text(`Relatório de Plantões Extras${filterLabel}`, 14, 20);
      
      doc.setFontSize(11);
      doc.text(`Período: ${periodLabel}`, 14, 30);
      
      let yPos = 36;
      if (reportPercentageFilter !== 'all') {
        doc.text(`Tipo: Extras a ${reportPercentageFilter}%`, 14, yPos);
        yPos += 6;
      }
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, yPos);

      doc.setFontSize(14);
      doc.text("Resumo", 14, yPos + 10);
      doc.setFontSize(10);
      const totalExtras = reportFilteredExtras.reduce((sum, extra) => sum + (Number(extra.quantity) || 1), 0);
      doc.text(`Total de extras no período: ${totalExtras}`, 14, yPos + 16);

      // Sort extras based on selected order
      const sortedExtras = [...reportFilteredExtras].sort((a, b) => {
        if (reportSortOrder === 'alphabetical') {
          const nameA = a.guard?.name || 'ZZZ';
          const nameB = b.guard?.name || 'ZZZ';
          return nameA.localeCompare(nameB, 'pt-BR');
        } else {
          return new Date(a.extra_date).getTime() - new Date(b.extra_date).getTime();
        }
      });

      const tableData = sortedExtras.map(extra => [
        extra.guard?.name || "Desconhecido",
        (extra.quantity || 1).toString(),
        `${extra.percentage_type || 100}%`,
        format(new Date(`${extra.extra_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR }),
        extra.justification,
      ]);

      autoTable(doc, {
        startY: yPos + 24,
        head: [["Segurança", "Horas", "Tipo", "Dia", "Fundamentação"]],
        body: tableData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 25 },
          4: { cellWidth: 'auto' }
        }
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      // Dynamic filename
      const typeSuffix = reportPercentageFilter === 'all' ? '' : `-${reportPercentageFilter}`;
      const periodSuffix = reportAllMonths ? 'acumulado' : format(filterMonth, "MM-yyyy");
      doc.save(`relatorio-extras${typeSuffix}-${periodSuffix}.pdf`);
      
      toast({
        title: "PDF gerado",
        description: "Relatório exportado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar PDF",
        description: "Ocorreu um erro ao gerar o relatório.",
      });
    }
  };

  const generateRankingPDF = (type: '50' | '100' | 'all') => {
    try {
      const rankingData = type === '50' ? rankingSummary50 : type === '100' ? rankingSummary100 : rankingSummary;
      
      if (rankingData.data.length === 0) {
        toast({
          variant: "destructive",
          title: "Sem dados",
          description: "Nenhum registro no período selecionado.",
        });
        return;
      }

      const doc = new jsPDF();
      
      const title = type === 'all' 
        ? "Ranking de Plantões Extras" 
        : `Ranking de Plantões Extras - ${type}%`;
      
      doc.setFontSize(18);
      doc.text(title, 14, 20);

      doc.setFontSize(11);
      doc.text(`Período: ${format(rankingDate, "MMMM 'de' yyyy", { locale: ptBR })}`, 14, 30);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 36);

      // Obter valores únicos de total, ordenados decrescente
      const uniqueTotals = [...new Set(rankingData.data.map(i => i.totalHours))].sort((a, b) => b - a);
      const tableData = rankingData.data.map((item) => {
        // Calcular posição baseada em valores únicos
        const position = uniqueTotals.indexOf(item.totalHours) + 1;
        return [
          `${position}º`,
          item.guardName,
          item.totalHours.toString()
        ];
      });

      autoTable(doc, {
        startY: 50,
        head: [["Posição", "Segurança", "Total de Horas"]],
        body: tableData,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 25, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 40, halign: 'center' }
        }
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      const suffix = type === 'all' ? '' : `-${type}`;
      doc.save(`ranking-extras${suffix}-${format(rankingDate, "MM-yyyy")}.pdf`);
      
      toast({
        title: "PDF gerado",
        description: "Ranking exportado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar PDF",
        description: "Ocorreu um erro ao gerar o ranking.",
      });
    }
  };

  const exportToCSV = (type: '50' | '100' | 'all') => {
    try {
      const rankingData = type === '50' ? rankingSummary50 : type === '100' ? rankingSummary100 : rankingSummary;
      
      if (rankingData.data.length === 0) {
        toast({
          variant: "destructive",
          title: "Sem dados",
          description: "Nenhum registro no período selecionado.",
        });
        return;
      }

      const title = type === 'all' 
        ? "Ranking de Plantões Extras" 
        : `Ranking de Plantões Extras - ${type}%`;

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += `${title}\n`;
      csvContent += `Período: ${format(rankingDate, "MMMM 'de' yyyy", { locale: ptBR })}\n`;
      csvContent += `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
      csvContent += "Posição,Segurança,Total de Horas\n";

      rankingData.data.forEach((item, index) => {
        csvContent += `${index + 1},${item.guardName},${item.totalHours}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      const suffix = type === 'all' ? '' : `-${type}`;
      link.setAttribute("download", `ranking-extras${suffix}-${format(rankingDate, "MM-yyyy")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "CSV exportado",
        description: "Ranking exportado com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      toast({
        variant: "destructive",
        title: "Erro ao exportar CSV",
        description: "Ocorreu um erro ao exportar o ranking.",
      });
    }
  };

  const handleSendWebhook = async () => {
    if (!preferenceDate || !user) return;
    
    setIsSendingWebhook(true);
    
    try {
      const formattedDate = format(preferenceDate, 'yyyy-MM-dd');
      
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
      const { data: extrasData, error: extrasError } = await supabase
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
      
      extrasData?.forEach(e => {
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
        'https://webhook.autozapx.com/webhook/preferencia-extra',
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

      toast({
        title: 'Dados enviados com sucesso!',
        description: 'Escala, trocas, ranking e folgas enviados para automação.',
      });

    } catch (error: any) {
      console.error('Erro ao enviar webhook:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar dados',
        description: error.message,
      });
    } finally {
      setIsSendingWebhook(false);
    }
  };

  return (
    <AppLayout title="Plantões Extras" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
      <div className="space-y-6">


      {/* Preferência no Extra */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Preferência no Extra
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Data do Extra</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {preferenceDate ? format(preferenceDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={preferenceDate}
                    onSelect={setPreferenceDate}
                    locale={ptBR}
                    disabled={(date) => date < new Date()}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <Button 
              onClick={handleSendWebhook}
              disabled={!preferenceDate || isSendingWebhook}
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
                  Preferência no Extra
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

      {/* Registration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Cadastrar Plantão Extra
          </CardTitle>
          <CardDescription>Registre um novo plantão extra realizado por um segurança</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="guard">Segurança *</Label>
                <Select 
                  value={selectedGuard} 
                  onValueChange={(value) => {
                    setSelectedGuard(value);
                    fetchGuardShiftDates(value, calendarMonth);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o segurança" />
                  </SelectTrigger>
                  <SelectContent>
                    {guards.map(guard => (
                      <SelectItem key={guard.id} value={guard.id}>
                        {guard.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data do Extra *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !extraDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {extraDate ? format(extraDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={extraDate}
                      onSelect={(date) => {
                        setExtraDate(date);
                        if (date) {
                          setPercentageType(getPercentageTypeByDate(date));
                        }
                      }}
                      locale={ptBR}
                      className="pointer-events-auto"
                      month={calendarMonth}
                      onMonthChange={(m) => {
                        setCalendarMonth(startOfMonth(m));
                        if (selectedGuard) {
                          fetchGuardShiftDates(selectedGuard, m);
                        }
                      }}
                      modifiers={{
                        shift: guardShiftDates
                      }}
                      modifiersClassNames={{
                        shift: "bg-primary/20 text-primary font-semibold"
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {selectedGuard && guardShiftDates.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="inline-block w-3 h-3 bg-primary/20 border border-primary/40 rounded mr-1"></span>
                    = Dias de plantão do segurança na escala
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Horas e Minutos de Extras Concedido *</Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      value={quantity ?? ''}
                      onChange={(e) => setQuantity(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="Horas"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">h</span>
                  <div className="w-24">
                    <Input
                      id="minutes"
                      type="number"
                      min="0"
                      max="59"
                      value={minutes}
                      onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                      placeholder="Min"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Extra *</Label>
                <Select 
                  value={percentageType.toString()} 
                  onValueChange={(value) => setPercentageType(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="100">100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">Fundamentação/Justificativa *</Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Descreva o motivo pelo qual o plantão extra foi concedido..."
                rows={4}
              />
            </div>

            <Button type="submit" className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Extra
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Relatório Mensal
          </CardTitle>
          <CardDescription>Selecione o período e o tipo de extras para gerar o relatório</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select 
                value={reportAllMonths ? 'all' : 'specific'} 
                onValueChange={(value) => setReportAllMonths(value === 'all')}
              >
                <SelectTrigger className="h-[60px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specific">Mês Específico</SelectItem>
                  <SelectItem value="all">Todos os Meses (Acumulado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!reportAllMonths && (
              <div className="space-y-2">
                <Label>Mês</Label>
                <div className="flex items-center justify-between gap-2 p-4 border rounded-lg bg-background h-[60px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilterMonth(startOfMonth(subMonths(filterMonth, 1)))}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center flex-1">
                    <p className="text-sm font-semibold capitalize">
                      {format(filterMonth, "MMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFilterMonth(startOfMonth(addMonths(filterMonth, 1)))}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de Extra</Label>
              <Select 
                value={reportPercentageFilter} 
                onValueChange={(value: 'all' | '50' | '100') => setReportPercentageFilter(value)}
              >
                <SelectTrigger className="h-[60px]">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="50">Apenas 50%</SelectItem>
                  <SelectItem value="100">Apenas 100%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ordenar por</Label>
              <Select 
                value={reportSortOrder} 
                onValueChange={(value: 'alphabetical' | 'date') => setReportSortOrder(value)}
              >
                <SelectTrigger className="h-[60px]">
                  <SelectValue placeholder="Selecione a ordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alphabetical">Ordem Alfabética (A-Z)</SelectItem>
                  <SelectItem value="date">Ordem por Data</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={generatePDF} variant="outline" className="w-full h-[60px]">
                <FileText className="mr-2 h-4 w-4" />
                Gerar Relatório PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ranking de Extras com Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking de Extras</CardTitle>
          <CardDescription>
            Total de horas de extras por segurança no período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filtros do Ranking */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Período</Label>
              <Select 
                value={rankingAllMonths ? "all" : "specific"} 
                onValueChange={(value) => setRankingAllMonths(value === "all")}
              >
                <SelectTrigger className="h-[60px]">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specific">Mês Específico</SelectItem>
                  <SelectItem value="all">Todos os Meses (Acumulado)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!rankingAllMonths && (
              <div className="space-y-2">
                <Label>Mês</Label>
                <div className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-background h-[60px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRankingDate(subMonths(rankingDate, 1))}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-center flex-1">
                    <p className="text-sm font-semibold capitalize">
                      {format(rankingDate, "MMMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRankingDate(addMonths(rankingDate, 1))}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de Extra</Label>
              <Select 
                value={rankingPercentageFilter} 
                onValueChange={(value: 'all' | '50' | '100') => setRankingPercentageFilter(value)}
              >
                <SelectTrigger className="h-[60px]">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="50">Apenas 50%</SelectItem>
                  <SelectItem value="100">Apenas 100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {extrasLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : rankingFilteredSummary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro encontrado para os filtros selecionados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Posição</TableHead>
                    <TableHead>Segurança</TableHead>
                    <TableHead className="text-center">Total de Horas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const uniqueTotals = [...new Set(rankingFilteredSummary.map(i => i.totalHours))].sort((a, b) => b - a);
                    return rankingFilteredSummary.map((item) => {
                      const position = uniqueTotals.indexOf(item.totalHours) + 1;
                      const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                      const isExpanded = expandedGuards.has(item.guardId);
                      const guardExtras = getGuardExtrasDetails(item.guardId);
                      
                      return (
                        <Collapsible key={item.guardId} open={isExpanded} onOpenChange={() => toggleGuardExpanded(item.guardId)} asChild>
                          <>
                            <CollapsibleTrigger asChild>
                              <TableRow className="cursor-pointer hover:bg-muted/50">
                                <TableCell className="font-medium">
                                  <span className="flex items-center gap-2">
                                    {medal && <span className="text-xl">{medal}</span>}
                                    {position}º
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    {item.guardName}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center font-semibold">{formatHoursMinutes(item.totalHours, item.totalMinutes || 0)}</TableCell>
                              </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={3} className="p-0">
                                  <div className="p-4 pl-12">
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Data</TableHead>
                                          <TableHead className="text-center">Horas</TableHead>
                                          <TableHead className="text-center">Tipo</TableHead>
                                          <TableHead>Fundamentação</TableHead>
                                          {role === 'admin' && (
                                            <TableHead className="text-center">Ações</TableHead>
                                          )}
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {guardExtras.map((extra) => (
                                          <TableRow key={extra.id}>
                                            <TableCell>
                                              {format(new Date(`${extra.extra_date}T00:00:00`), "dd/MM/yyyy")}
                                            </TableCell>
                                            <TableCell className="text-center">{formatHoursMinutes(extra.quantity, extra.minutes || 0)}</TableCell>
                                            <TableCell className="text-center">
                                              <span className={cn(
                                                "px-2 py-1 rounded-full text-xs font-medium",
                                                extra.percentage_type === 100 
                                                  ? "bg-green-100 text-green-800" 
                                                  : "bg-yellow-100 text-yellow-800"
                                              )}>
                                                {extra.percentage_type}%
                                              </span>
                                            </TableCell>
                                            <TableCell className="max-w-[300px] truncate" title={extra.justification}>
                                              {extra.justification}
                                            </TableCell>
                                            {role === 'admin' && (
                                              <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      openEditDialog(extra);
                                                    }}
                                                    title="Editar"
                                                  >
                                                    <Edit className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setDeletingExtraId(extra.id);
                                                    }}
                                                    title="Excluir"
                                                    className="text-destructive hover:text-destructive"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              </TableCell>
                                            )}
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extras Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registros Detalhados de Extras</CardTitle>
          <CardDescription>
            {detailsExtras.length} {detailsExtras.length === 1 ? "registro encontrado" : "registros encontrados"}
          </CardDescription>
          
          {/* Month Navigation */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDetailsMonth(subMonths(detailsMonth, 1))}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[150px]">
              <p className="text-lg font-semibold capitalize">
                {format(detailsMonth, "MMMM yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDetailsMonth(addMonths(detailsMonth, 1))}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {extrasLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : detailsExtras.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro encontrado para o período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleDetailsSort('guardName')}
                    >
                      <div className="flex items-center gap-1">
                        Segurança
                        {detailsSortColumn === 'guardName' ? (
                          detailsSortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleDetailsSort('quantity')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Horas
                        {detailsSortColumn === 'quantity' ? (
                          detailsSortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleDetailsSort('percentage_type')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Tipo
                        {detailsSortColumn === 'percentage_type' ? (
                          detailsSortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-center cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleDetailsSort('extra_date')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        Data
                        {detailsSortColumn === 'extra_date' ? (
                          detailsSortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronsUpDown className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead>Fundamentação</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailsExtras.map((extra) => (
                    <TableRow key={extra.id}>
                      <TableCell className="font-medium">{extra.guard?.name || "Desconhecido"}</TableCell>
                      <TableCell className="text-center">{formatHoursMinutes(extra.quantity || 1, extra.minutes || 0)}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          extra.percentage_type === 50 
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" 
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                        )}>
                          {extra.percentage_type || 100}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {format(new Date(`${extra.extra_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{extra.justification}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(extra)}
                            className="text-primary hover:text-primary"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingExtraId(extra.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
          {/* Ranking Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros do Ranking</CardTitle>
              <CardDescription>Selecione o mês para visualizar o ranking de extras</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Selecione o Mês</Label>
                  <div className="flex items-center justify-between gap-2 p-4 border rounded-lg bg-background">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRankingDate(subMonths(rankingDate, 1))}
                      className="h-8 w-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-center flex-1">
                      <p className="text-lg font-semibold capitalize">
                        {format(rankingDate, "MMMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setRankingDate(addMonths(rankingDate, 1))}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Período Selecionado:</p>
                  <p className="text-lg font-bold text-primary">{format(rankingDate, "MMMM 'de' yyyy", { locale: ptBR })}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(rankingSummary.startDate, "dd/MM/yyyy")} até {format(rankingSummary.endDate, "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ranking 50% */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-full text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">50%</span>
                Ranking de Extras - 50%
              </CardTitle>
              <CardDescription>Ranking de horas extras com adicional de 50%</CardDescription>
            </CardHeader>
            <CardContent>
              {extrasLoading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : rankingSummary50.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro de 50% encontrado para o período selecionado.
                </div>
              ) : (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={rankingSummary50.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="guardName" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                      />
                      <YAxis label={{ value: 'Horas', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Bar dataKey="totalHours" fill="hsl(45, 93%, 47%)" name="Total de Horas" />
                    </BarChart>
                  </ResponsiveContainer>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Posição</TableHead>
                          <TableHead>Segurança</TableHead>
                          <TableHead className="text-center w-32">Total de Horas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // Obter valores únicos de total, ordenados decrescente
                          const uniqueTotals = [...new Set(rankingSummary50.data.map(i => i.totalHours))].sort((a, b) => b - a);
                          return rankingSummary50.data.map((item) => {
                          // Calcular posição baseada em valores únicos
                          const position = uniqueTotals.indexOf(item.totalHours) + 1;
                          return (
                            <TableRow key={item.guardId}>
                              <TableCell className="font-bold text-lg">
                                {position === 1 && "🥇 "}
                                {position === 2 && "🥈 "}
                                {position === 3 && "🥉 "}
                                {position}º
                              </TableCell>
                              <TableCell className="font-medium">{item.guardName}</TableCell>
                              <TableCell className="text-center font-bold text-lg text-amber-600">
                                {item.totalHours}
                              </TableCell>
                            </TableRow>
                          );
                        })})()}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={() => generateRankingPDF('50')} variant="outline" className="flex-1">
                      <FileText className="mr-2 h-4 w-4" />
                      Exportar PDF
                    </Button>
                    <Button onClick={() => exportToCSV('50')} variant="outline" className="flex-1">
                      <Download className="mr-2 h-4 w-4" />
                      Exportar CSV
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ranking 100% */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-full text-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">100%</span>
                Ranking de Extras - 100%
              </CardTitle>
              <CardDescription>Ranking de horas extras com adicional de 100%</CardDescription>
            </CardHeader>
            <CardContent>
              {extrasLoading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : rankingSummary100.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro de 100% encontrado para o período selecionado.
                </div>
              ) : (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={rankingSummary100.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="guardName" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                      />
                      <YAxis label={{ value: 'Horas', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Bar dataKey="totalHours" fill="hsl(152, 69%, 31%)" name="Total de Horas" />
                    </BarChart>
                  </ResponsiveContainer>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Posição</TableHead>
                          <TableHead>Segurança</TableHead>
                          <TableHead className="text-center w-32">Total de Horas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // Obter valores únicos de total, ordenados decrescente
                          const uniqueTotals = [...new Set(rankingSummary100.data.map(i => i.totalHours))].sort((a, b) => b - a);
                          return rankingSummary100.data.map((item) => {
                          // Calcular posição baseada em valores únicos
                          const position = uniqueTotals.indexOf(item.totalHours) + 1;
                          return (
                            <TableRow key={item.guardId}>
                              <TableCell className="font-bold text-lg">
                                {position === 1 && "🥇 "}
                                {position === 2 && "🥈 "}
                                {position === 3 && "🥉 "}
                                {position}º
                              </TableCell>
                              <TableCell className="font-medium">{item.guardName}</TableCell>
                              <TableCell className="text-center font-bold text-lg text-emerald-600">
                                {item.totalHours}
                              </TableCell>
                            </TableRow>
                          );
                        })})()}
                      </TableBody>
                    </Table>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={() => generateRankingPDF('100')} variant="outline" className="flex-1">
                      <FileText className="mr-2 h-4 w-4" />
                      Exportar PDF
                    </Button>
                    <Button onClick={() => exportToCSV('100')} variant="outline" className="flex-1">
                      <Download className="mr-2 h-4 w-4" />
                      Exportar CSV
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingExtra} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Plantão Extra</DialogTitle>
            <DialogDescription>Atualize as informações do plantão extra</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-guard">Segurança *</Label>
              <Select value={editGuardId} onValueChange={setEditGuardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o segurança" />
                </SelectTrigger>
                <SelectContent>
                  {guards.map(guard => (
                    <SelectItem key={guard.id} value={guard.id}>
                      {guard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Extra *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editDate ? format(editDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={editDate}
                      onSelect={setEditDate}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Horas e Minutos de Extras Concedido *</Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Input
                      id="edit-quantity"
                      type="number"
                      min="0"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">h</span>
                  <div className="w-24">
                    <Input
                      id="edit-minutes"
                      type="number"
                      min="0"
                      max="59"
                      value={editMinutes}
                      onChange={(e) => setEditMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Extra *</Label>
              <Select 
                value={editPercentageType.toString()} 
                onValueChange={(value) => setEditPercentageType(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-justification">Fundamentação/Justificativa *</Label>
              <Textarea
                id="edit-justification"
                value={editJustification}
                onChange={(e) => setEditJustification(e.target.value)}
                placeholder="Descreva o motivo pelo qual o plantão extra foi concedido..."
                rows={4}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={closeEditDialog}>
                Cancelar
              </Button>
              <Button onClick={handleUpdate}>
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingExtraId} onOpenChange={(open) => !open && setDeletingExtraId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro de extra? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AppLayout>
  );
}
