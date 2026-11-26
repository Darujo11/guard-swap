import { useEffect, useMemo, useState } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getTeamCalendarColor } from "@/utils/monthlyDutyReport";

interface AdminDutyCalendarProps {
  reloadKey?: number;
}

interface TeamLite {
  id: string;
  name: string;
  color: string | null;
}

interface GuardLite {
  id: string;
  name: string;
  team_id: string | null;
}

interface ScheduleLite {
  id: string;
  team_id: string;
  shift_date: string;
}

interface SwapLite {
  id: string;
  requester_id: string;
  target_id: string;
  requester_shift_date: string;
  target_shift_date: string;
  status: string;
}

interface ExtraLite {
  id: string;
  guard_id: string;
  extra_date: string;
  quantity: number;
  justification: string;
  percentage_type: number;
}

interface LeaveLite {
  id: string;
  guard_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  custom_type: string | null;
  status: string;
}

interface DutyLeave {
  guardId: string;
  guardName: string;
  label: string;
}

interface DutyGuard {
  id: string;
  name: string;
  originalTeamId: string | null;
  assignmentTeamId: string | null;
  isSwapCoverage?: boolean;
  swappedWithName?: string;
  swapCurrentDate?: string;
  swapOtherDate?: string;
  isExtra?: boolean;
  extraQuantity?: number;
  extraJustification?: string;
  extraPercentage?: number;
}

interface DayDuty {
  date: string;
  scheduledTeam: TeamLite | null;
  guardsOnDuty: DutyGuard[];
  extrasOnly: DutyGuard[];
  leaves: DutyLeave[];
}

const GOLDEN = "#B8860B";

const getLeaveLabel = (leaveType: string, customType?: string | null): string => {
  switch (leaveType) {
    case "TRE":
      return "TRE";
    case "ATESTADO":
      return "Atestado";
    case "FERIAS":
      return "Ferias";
    case "LICENCA_NOJO":
      return "Lic. Nojo";
    case "LICENCA_PATERNIDADE":
      return "Lic. Paternidade";
    case "LICENCA_NAO_REMUNERADA":
      return "Lic. Nao Remunerada";
    case "FALTA_INJUSTIFICADA":
      return "Falta";
    default:
      return customType || "Afastamento";
  }
};

const isLeaveActiveOnDate = (leave: LeaveLite, dateStr: string): boolean => {
  // Regra operacional:
  // - FERIAS: vale para todo o período (start_date -> end_date)
  // - Demais afastamentos: contam apenas no dia do plantão (start_date)
  if (leave.leave_type === "FERIAS") {
    return leave.start_date <= dateStr && leave.end_date >= dateStr;
  }
  return leave.start_date === dateStr;
};

export function AdminDutyCalendar({ reloadKey = 0 }: AdminDutyCalendarProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [pdfSelectionMode, setPdfSelectionMode] = useState(false);
  const [pdfSelectedDates, setPdfSelectedDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [teams, setTeams] = useState<TeamLite[]>([]);
  const [guards, setGuards] = useState<GuardLite[]>([]);
  const [schedules, setSchedules] = useState<ScheduleLite[]>([]);
  const [approvedSwaps, setApprovedSwaps] = useState<SwapLite[]>([]);
  const [extras, setExtras] = useState<ExtraLite[]>([]);
  const [leaves, setLeaves] = useState<LeaveLite[]>([]);

  const adminId = profile?.admin_id || profile?.id || null;

  useEffect(() => {
    if (!adminId) return;
    fetchMonthData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminId, currentMonth, reloadKey]);

  const fetchMonthData = async () => {
    if (!adminId) return;
    setLoading(true);
    try {
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const [teamsRes, guardsRes, schedulesRes, swapsRes, extrasRes, leavesRes] = await Promise.all([
        supabase.from("teams").select("id,name,color").eq("admin_id", adminId).order("name"),
        supabase.from("profiles").select("id,name,team_id").eq("admin_id", adminId).order("name"),
        supabase
          .from("team_schedules")
          .select("id,team_id,shift_date")
          .eq("admin_id", adminId)
          .gte("shift_date", monthStart)
          .lte("shift_date", monthEnd),
        supabase
          .from("swap_requests")
          .select("id,requester_id,target_id,requester_shift_date,target_shift_date,status")
          .eq("admin_id", adminId)
          .eq("status", "APPROVED")
          .or(`requester_shift_date.gte.${monthStart},target_shift_date.gte.${monthStart}`),
        supabase
          .from("extras")
          .select("id,guard_id,extra_date,quantity,justification,percentage_type")
          .eq("admin_id", adminId)
          .gte("extra_date", monthStart)
          .lte("extra_date", monthEnd),
        supabase
          .from("leaves")
          .select("id,guard_id,start_date,end_date,leave_type,custom_type,status")
          .eq("admin_id", adminId)
          .eq("status", "APPROVED")
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart),
      ]);

      if (teamsRes.error) throw teamsRes.error;
      if (guardsRes.error) throw guardsRes.error;
      if (schedulesRes.error) throw schedulesRes.error;
      if (swapsRes.error) throw swapsRes.error;
      if (extrasRes.error) throw extrasRes.error;
      if (leavesRes.error) throw leavesRes.error;

      const monthEndDate = endOfMonth(currentMonth);
      const filteredSwaps = (swapsRes.data || []).filter((s) => {
        const r = new Date(`${s.requester_shift_date}T00:00:00`);
        const t = new Date(`${s.target_shift_date}T00:00:00`);
        const monthStartDate = startOfMonth(currentMonth);
        return (r >= monthStartDate && r <= monthEndDate) || (t >= monthStartDate && t <= monthEndDate);
      });

      setTeams((teamsRes.data || []) as TeamLite[]);
      setGuards((guardsRes.data || []) as GuardLite[]);
      setSchedules((schedulesRes.data || []) as ScheduleLite[]);
      setApprovedSwaps(filteredSwaps as SwapLite[]);
      setExtras((extrasRes.data || []) as ExtraLite[]);
      setLeaves((leavesRes.data || []) as LeaveLite[]);
    } catch (error) {
      console.error("[AdminDutyCalendar] fetchMonthData", error);
      toast({
        title: "Erro ao carregar calendário inteligente",
        description: "Não foi possível carregar os dados de escala.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const guardsById = useMemo(() => new Map(guards.map((g) => [g.id, g])), [guards]);

  const buildDayDuty = (dateStr: string): DayDuty => {
    const daySchedule = schedules.find((s) => s.shift_date === dateStr) || null;
    const scheduledTeam = daySchedule ? teamsById.get(daySchedule.team_id) || null : null;

    const baseGuards = scheduledTeam ? guards.filter((g) => g.team_id === scheduledTeam.id) : [];
    const roster = new Map<string, DutyGuard>(
      baseGuards.map((g) => [
        g.id,
        {
          id: g.id,
          name: g.name,
          originalTeamId: g.team_id,
          assignmentTeamId: scheduledTeam?.id || null,
          isSwapCoverage: false,
        },
      ])
    );

    const daySwaps = approvedSwaps.filter(
      (s) => s.requester_shift_date === dateStr || s.target_shift_date === dateStr
    );

    for (const swap of daySwaps) {
      const requester = guardsById.get(swap.requester_id);
      const target = guardsById.get(swap.target_id);

      if (swap.requester_shift_date === dateStr) {
        roster.delete(swap.requester_id);
        if (target) {
          const assignmentTeamId = requester?.team_id || scheduledTeam?.id || null;
          roster.set(target.id, {
            id: target.id,
            name: target.name,
            originalTeamId: target.team_id,
            assignmentTeamId,
            isSwapCoverage: true,
            swappedWithName: requester?.name || "colega",
            swapCurrentDate: swap.requester_shift_date,
            swapOtherDate: swap.target_shift_date,
          });
        }
      }

      if (swap.target_shift_date === dateStr) {
        roster.delete(swap.target_id);
        if (requester) {
          const assignmentTeamId = target?.team_id || scheduledTeam?.id || null;
          roster.set(requester.id, {
            id: requester.id,
            name: requester.name,
            originalTeamId: requester.team_id,
            assignmentTeamId,
            isSwapCoverage: true,
            swappedWithName: target?.name || "colega",
            swapCurrentDate: swap.target_shift_date,
            swapOtherDate: swap.requester_shift_date,
          });
        }
      }
    }

    const dayExtras = extras.filter((e) => e.extra_date === dateStr);
    const extrasOnly: DutyGuard[] = [];
    const candidateLeaves = leaves
      .filter((l) => isLeaveActiveOnDate(l, dateStr))
      .map((l) => {
        const guard = guardsById.get(l.guard_id);
        return {
          guardId: l.guard_id,
          guardName: guard?.name || "Seguranca",
          label:
            l.leave_type === "FERIAS"
              ? `${getLeaveLabel(l.leave_type, l.custom_type)} (${l.start_date} a ${l.end_date})`
              : getLeaveLabel(l.leave_type, l.custom_type),
        };
      });

    // Regra solicitada: só registrar afastamento se o segurança estaria de plantão naquele dia.
    const uniqueLeavesMap = new Map<string, DutyLeave>();
    candidateLeaves
      .filter((lv) => roster.has(lv.guardId))
      .forEach((lv) => {
        const key = `${lv.guardId}::${lv.label}`;
        if (!uniqueLeavesMap.has(key)) uniqueLeavesMap.set(key, lv);
      });
    const dayLeaves = Array.from(uniqueLeavesMap.values());

    for (const lv of dayLeaves) {
      roster.delete(lv.guardId);
    }

    for (const extra of dayExtras) {
      const guard = guardsById.get(extra.guard_id);
      if (!guard) continue;
      if (roster.has(guard.id)) {
        const prev = roster.get(guard.id)!;
        roster.set(guard.id, {
          ...prev,
          isExtra: true,
          extraQuantity: extra.quantity,
          extraJustification: extra.justification,
          extraPercentage: extra.percentage_type,
        });
      } else {
        extrasOnly.push({
          id: guard.id,
          name: guard.name,
          originalTeamId: guard.team_id,
          assignmentTeamId: null,
          isExtra: true,
          extraQuantity: extra.quantity,
          extraJustification: extra.justification,
          extraPercentage: extra.percentage_type,
        });
      }
    }

    return {
      date: dateStr,
      scheduledTeam,
      guardsOnDuty: Array.from(roster.values()).sort((a, b) => a.name.localeCompare(b.name)),
      extrasOnly: extrasOnly.sort((a, b) => a.name.localeCompare(b.name)),
      leaves: dayLeaves.sort((a, b) => a.guardName.localeCompare(b.guardName)),
    };
  };

  const monthDays = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);

  const dayDutyByDate = useMemo(() => {
    const map = new Map<string, DayDuty>();
    monthDays.forEach((d) => {
      const ds = format(d, "yyyy-MM-dd");
      map.set(ds, buildDayDuty(ds));
    });
    return map;
  }, [monthDays, schedules, approvedSwaps, extras, leaves, guards, teams]);

  const selectedDayDuty = useMemo(
    () => dayDutyByDate.get(selectedDate) || buildDayDuty(selectedDate),
    [selectedDate, dayDutyByDate, schedules, approvedSwaps, extras, leaves, guards, teams]
  );

  const selectedDayGroups = useMemo(() => {
    const groups = new Map<string, { teamName: string; teamColor: string; guards: DutyGuard[] }>();
    for (const g of selectedDayDuty.guardsOnDuty) {
      const team = g.assignmentTeamId ? teamsById.get(g.assignmentTeamId) : null;
      const key = team?.id || "sem-equipe";
      if (!groups.has(key)) {
        groups.set(key, {
          teamName: team?.name || "Sem equipe",
          teamColor: getTeamCalendarColor(team?.name, team?.color),
          guards: [],
        });
      }
      groups.get(key)!.guards.push(g);
    }
    return Array.from(groups.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [selectedDayDuty, teamsById]);

  const visibleMonthDateStrings = useMemo(
    () => monthDays.map((d) => format(d, "yyyy-MM-dd")),
    [monthDays]
  );

  const exportSelectedDayPdf = () => {
    const duty = selectedDayDuty;
    const dateLabel = format(new Date(`${duty.date}T00:00:00`), "dd/MM/yyyy");
    const doc = new jsPDF("p");

    doc.setFontSize(16);
    doc.text("Plantao Diario - Equipes e Trocas", 14, 18);
    doc.setFontSize(11);
    doc.text(`Data: ${dateLabel}`, 14, 26);
    doc.text(`Equipe base: ${duty.scheduledTeam?.name || "Sem equipe cadastrada no dia"}`, 14, 33);
    doc.text("Turno: 24h (07:00 ate 07:00 do dia seguinte)", 14, 40);

    const formatBrDate = (isoDate?: string) => {
      if (!isoDate) return "";
      const [y, m, d] = isoDate.split("-");
      if (!y || !m || !d) return isoDate;
      return `${d}/${m}/${y}`;
    };

    autoTable(doc, {
      startY: 46,
      head: [["Nome", "Troca", "Extra"]],
      body: duty.guardsOnDuty.map((g) => {
        const swapStatus = g.isSwapCoverage
          ? `Com ${g.swappedWithName || "colega"} (${formatBrDate(g.swapCurrentDate)} <-> ${formatBrDate(g.swapOtherDate)})`
          : "-";
        const extraStatus = g.isExtra
          ? `${g.extraQuantity ?? 0}h (${g.extraPercentage ?? 0}%) - Fundamentação: ${g.extraJustification || "Não informada"}`
          : "-";
        return [
          g.name,
          swapStatus,
          extraStatus,
        ];
      }),
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 9, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 65 },
        2: { cellWidth: 75 },
      },
    });

    if (duty.extrasOnly.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 8,
        head: [["Extra sem plantão base", "Horas", "Fundamentação"]],
        body: duty.extrasOnly.map((g) => {
          return [g.name, `${g.extraQuantity ?? 0}h`, g.extraJustification || "Sem fundamentação"];
        }),
        theme: "grid",
        headStyles: { fillColor: [184, 134, 11] },
        styles: { fontSize: 9 },
      });
    }

    if (duty.leaves.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 6,
        head: [["Afastado", "Tipo"]],
        body: duty.leaves.map((l) => [l.guardName, l.label]),
        theme: "grid",
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 9 },
      });
    }

    doc.save(`plantao-${duty.date}.pdf`);
  };

  const exportMultipleDaysPdf = () => {
    if (pdfSelectedDates.length === 0) {
      toast({
        title: "Selecione ao menos um dia",
        description: "Marque os dias no calendário para gerar o PDF.",
        variant: "destructive",
      });
      return;
    }

    const sortedDates = [...pdfSelectedDates].sort();
    const doc = new jsPDF("p");
    const pageHeight = doc.internal.pageSize.height;
    const pagePaddingTop = 12;
    const pagePaddingBottom = 10;
    const blocksPerPage = 3;
    const usableHeight = pageHeight - pagePaddingTop - pagePaddingBottom;
    const blockHeight = usableHeight / blocksPerPage;
    const tableStartOffset = 14;
    const tableBottomMargin = 2;
    const tableBodyRows = 3;
    const extraRows = 2;

    const formatBrDate = (isoDate?: string) => {
      if (!isoDate) return "";
      const [y, m, d] = isoDate.split("-");
      if (!y || !m || !d) return isoDate;
      return `${d}/${m}/${y}`;
    };

    sortedDates.forEach((dateStr, index) => {
      const blockIndex = index % blocksPerPage;
      if (blockIndex === 0 && index > 0) doc.addPage();
      const blockTopY = pagePaddingTop + blockIndex * blockHeight;
      const maxTableHeight = blockHeight - tableStartOffset - tableBottomMargin;

      const duty = buildDayDuty(dateStr);
      const dateLabel = format(new Date(`${dateStr}T00:00:00`), "dd/MM/yyyy");

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Dia ${dateLabel}`, 14, blockTopY + 4);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Equipe base: ${duty.scheduledTeam?.name || "Sem equipe cadastrada no dia"}`, 14, blockTopY + 9);
      doc.text("Turno 24h: 07:00 ate 07:00", 14, blockTopY + 13);

      autoTable(doc, {
        startY: blockTopY + tableStartOffset + 2,
        head: [["Nome", "Troca", "Extra"]],
        body: duty.guardsOnDuty.map((g) => {
          const swapStatus = g.isSwapCoverage
            ? `Com ${g.swappedWithName || "colega"} (${formatBrDate(g.swapCurrentDate)} <-> ${formatBrDate(g.swapOtherDate)})`
            : "-";
          const extraStatus = g.isExtra
            ? `${g.extraQuantity ?? 0}h (${g.extraPercentage ?? 0}%) - Fundamentação: ${g.extraJustification || "Não informada"}`
            : "-";
          return [
            g.name,
            swapStatus,
            extraStatus,
          ];
        }),
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 7, overflow: "linebreak", cellPadding: 1.2 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 58 },
          2: { cellWidth: 90 },
        },
        margin: { left: 14, right: 14 },
        rowPageBreak: "avoid",
        pageBreak: "avoid",
        bodyStyles: { minCellHeight: 4 },
        showHead: "firstPage",
        didDrawPage: () => {},
        willDrawCell: (data: any) => {
          if (!data.row) return;
          if (data.row.index >= tableBodyRows) {
            data.cell.text = ["..."];
          }
        },
      });

      const lastY = (doc as any).lastAutoTable?.finalY || blockTopY + tableStartOffset;
      const remainingForExtras = blockTopY + maxTableHeight - lastY;
      if (duty.extrasOnly.length > 0 && remainingForExtras > 12) {
        autoTable(doc, {
          startY: lastY + 2,
          head: [["Extra", "Horas", "Fundamentação"]],
          body: duty.extrasOnly.slice(0, extraRows).map((g) => {
            return [g.name, `${g.extraQuantity ?? 0}h`, g.extraJustification || "Sem fundamentação"];
          }),
          theme: "grid",
          headStyles: { fillColor: [184, 134, 11] },
          styles: { fontSize: 7, overflow: "linebreak", cellPadding: 1.2 },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 15 },
            2: { cellWidth: 133 },
          },
          margin: { left: 14, right: 14 },
          rowPageBreak: "avoid",
          pageBreak: "avoid",
        });
      }

      const afterExtrasY = (doc as any).lastAutoTable?.finalY || lastY;
      const remainingForLeaves = blockTopY + maxTableHeight - afterExtrasY;
      if (duty.leaves.length > 0 && remainingForLeaves > 10) {
        autoTable(doc, {
          startY: afterExtrasY + 2,
          head: [["Afastado", "Tipo"]],
          body: duty.leaves.slice(0, 2).map((l) => [l.guardName, l.label]),
          theme: "grid",
          headStyles: { fillColor: [220, 38, 38] },
          styles: { fontSize: 7, overflow: "linebreak", cellPadding: 1.2 },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { cellWidth: 103 },
          },
          margin: { left: 14, right: 14 },
          rowPageBreak: "avoid",
          pageBreak: "avoid",
        });
      }

      // Divider between blocks (except at the end of page).
      if (blockIndex < blocksPerPage - 1) {
        const dividerY = blockTopY + blockHeight - 1;
        doc.setDrawColor(220, 220, 220);
        doc.line(12, dividerY, doc.internal.pageSize.width - 12, dividerY);
      }
    });

    doc.save(`plantoes-selecionados-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const togglePdfDateSelection = (dateStr: string) => {
    setPdfSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  const renderDayCell = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const daySchedule = schedules.find((s) => s.shift_date === dateStr);
    const team = daySchedule ? teamsById.get(daySchedule.team_id) : null;
    const hasLeave = (dayDutyByDate.get(dateStr)?.leaves.length || 0) > 0;
    const isSelected = selectedDate === dateStr;
    const isPdfSelected = pdfSelectedDates.includes(dateStr);
    const teamColor = getTeamCalendarColor(team?.name, team?.color);

    return (
      <button
        key={dateStr}
        type="button"
        onClick={() => {
          if (pdfSelectionMode) {
            togglePdfDateSelection(dateStr);
            return;
          }
          setSelectedDate(dateStr);
          setDayDialogOpen(true);
        }}
        className={`h-14 rounded-md border p-1 text-left transition-all duration-200 bg-muted/25 ${
          isSelected
            ? "ring-2 ring-primary shadow-md"
            : isPdfSelected
              ? "ring-2 ring-amber-500 shadow-md"
              : hasLeave
                ? "ring-1 ring-red-400 hover:border-red-500 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02]"
                : "hover:border-primary/70 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02]"
        }`}
        style={team ? { background: `linear-gradient(180deg, ${teamColor}2e 0%, ${teamColor}1a 100%)`, borderColor: teamColor } : undefined}
      >
        <div className="text-xs font-semibold inline-flex items-center justify-center min-w-5 h-5 px-1 rounded bg-background/80">
          {format(date, "d")}
        </div>
        {team && <div className="truncate text-[10px] mt-1">{team.name}</div>}
        {hasLeave && <div className="text-[9px] text-red-700 font-medium">Afast.</div>}
      </button>
    );
  };

  return (
    <Card className="order-3">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Calendário Inteligente de Plantão</CardTitle>
            <CardDescription>
              Clique no dia para ver equipes de plantão, trocas aplicadas e extras.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchMonthData} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={exportSelectedDayPdf} className="gap-2">
              <Download className="h-4 w-4" />
              PDF do dia
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((p) => subMonths(p, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth((p) => addMonths(p, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={pdfSelectionMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setPdfSelectionMode((prev) => !prev);
              if (pdfSelectionMode) setPdfSelectedDates([]);
            }}
          >
            {pdfSelectionMode ? "Sair da seleção" : "Selecionar dias para PDF"}
          </Button>
          {pdfSelectionMode && (
            <>
              <Button
                size="sm"
                onClick={exportMultipleDaysPdf}
                className="gap-2"
                disabled={pdfSelectedDates.length === 0}
              >
                <Download className="h-4 w-4" />
                Gerar PDF ({pdfSelectedDates.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPdfSelectedDates([])}
                disabled={pdfSelectedDates.length === 0}
              >
                Limpar seleção
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPdfSelectedDates((prev) => Array.from(new Set([...prev, ...visibleMonthDateStrings])))}
              >
                Selecionar mês inteiro
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPdfSelectedDates((prev) => prev.filter((d) => !visibleMonthDateStrings.includes(d)))}
                disabled={!pdfSelectedDates.some((d) => visibleMonthDateStrings.includes(d))}
              >
                Desmarcar mês inteiro
              </Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground">
              {d}
            </div>
          ))}
          {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {monthDays.map(renderDayCell)}
        </div>

        <div className="rounded-md border p-4">
          <p className="text-sm text-muted-foreground">
            Clique em um dia no calendário para abrir o popup com os membros do plantão, trocas e extras atualizados.
          </p>
        </div>
      </CardContent>

      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Plantão do dia {format(new Date(`${selectedDate}T00:00:00`), "dd/MM/yyyy")}
            </DialogTitle>
            <DialogDescription>
              Visualização diária com trocas e extras atualizados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="outline">
                Equipe base: {selectedDayDuty.scheduledTeam?.name || "Sem escala"}
              </Badge>
              <Button size="sm" onClick={exportSelectedDayPdf} className="gap-2">
                <Download className="h-4 w-4" />
                PDF do dia
              </Button>
            </div>

            {selectedDayGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum profissional escalado nesse dia.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayGroups.map((group) => (
                  <div key={group.teamName} className="rounded border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: group.teamColor }} />
                      <p className="font-medium">Equipe {group.teamName.replace(/^Equipe\s*/i, "")}</p>
                    </div>
                    <div className="space-y-1">
                      {group.guards.map((g) => (
                        <div key={g.id} className="flex items-center gap-2 text-sm">
                          {(() => {
                            const originalTeam = g.originalTeamId ? teamsById.get(g.originalTeamId) : null;
                            const originalColor = getTeamCalendarColor(originalTeam?.name, originalTeam?.color);
                            return (
                              <>
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: originalColor }}
                                />
                                <span
                                  style={{ color: originalColor }}
                                  className="font-medium"
                                >
                                  {g.name}
                                </span>
                              </>
                            );
                          })()}
                          {g.isSwapCoverage && (
                            <span className="text-xs text-muted-foreground">
                              (troca com {g.swappedWithName || "colega"})
                            </span>
                          )}
                          {g.isExtra && (
                            <span className="text-xs text-muted-foreground">+ extra</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedDayDuty.extrasOnly.length > 0 && (
              <div className="rounded border p-3">
                <p className="font-medium mb-2">Extras do dia (sem plantão base)</p>
                <div className="flex flex-wrap gap-2">
                  {selectedDayDuty.extrasOnly.map((g) => (
                    <Badge key={`extra-${g.id}`} style={{ backgroundColor: GOLDEN, color: "#fff" }}>
                      {g.name} (extra)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedDayDuty.leaves.length > 0 && (
              <div className="rounded border p-3">
                <p className="font-medium mb-2">Afastamentos do dia</p>
                <div className="flex flex-wrap gap-2">
                  {selectedDayDuty.leaves.map((l) => (
                    <Badge key={`${l.guardId}-${l.label}`} variant="outline" className="border-red-300 text-red-700">
                      {l.guardName} ({l.label})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
