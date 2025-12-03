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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, FileText, Trash2, Download, BarChart3, ChevronLeft, ChevronRight, Edit } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Profile } from "@/lib/types";

interface Extra {
  id: string;
  guard_id: string;
  extra_date: string;
  month_reference: string;
  justification: string;
  quantity: number;
  created_at: string;
  guard?: Profile;
}

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
  const [quantity, setQuantity] = useState<number>(1);
  const [guardShiftDates, setGuardShiftDates] = useState<Date[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(new Date()));
  
  // Filter state
  const [filterMonth, setFilterMonth] = useState<Date>(new Date());
  
  // Ranking filter state
  const [rankingDate, setRankingDate] = useState<Date>(new Date());
  
  // Details filter state (separate from filterMonth)
  const [detailsMonth, setDetailsMonth] = useState<Date>(new Date());
  
  // Edit dialog state
  const [editingExtra, setEditingExtra] = useState<Extra | null>(null);
  const [editGuardId, setEditGuardId] = useState<string>("");
  const [editDate, setEditDate] = useState<Date>();
  const [editJustification, setEditJustification] = useState("");
  const [editQuantity, setEditQuantity] = useState<number>(1);
  
  // Delete confirmation state
  const [deletingExtraId, setDeletingExtraId] = useState<string | null>(null);

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

  const rankingSummary = useMemo(() => {
    const startDate = startOfMonth(rankingDate);
    const endDate = endOfMonth(rankingDate);

    const periodExtras = extras.filter((extra) => {
      // Adiciona T00:00:00 para interpretar como hora local, não UTC
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

    return extras
      .filter((extra) => {
        const extraDate = new Date(`${extra.extra_date}T00:00:00`);
        return extraDate >= startDate && extraDate <= endDate;
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.extra_date}T00:00:00`);
        const dateB = new Date(`${b.extra_date}T00:00:00`);
        return dateA.getTime() - dateB.getTime();
      });
  }, [extras, detailsMonth]);

  const fetchGuards = async () => {
    // 1) Buscar todos os user_ids com papel de guard
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

    // 2) Buscar perfis desses usuários
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

    // 1) Buscar extras sem join
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

    // 2) Buscar perfis dos guards usados nos extras
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
      // 1) Buscar o team_id e nome do segurança para debug
      const { data: guardProfile, error: profileError } = await supabase
        .from("profiles")
        .select("team_id, name")
        .eq("id", guardId)
        .maybeSingle();

      console.log("[fetchGuardShiftDates] Guard profile:", guardProfile);

      if (profileError) {
        console.error("[fetchGuardShiftDates] Error fetching profile:", profileError);
        setGuardShiftDates([]);
        return;
      }

      if (!guardProfile?.team_id) {
        console.log("[fetchGuardShiftDates] Guard has no team_id");
        setGuardShiftDates([]);
        return;
      }

      // Preparar intervalo do mês atual do calendário
      const start = startOfMonth(month);
      const end = endOfMonth(month);

      // 2) Buscar todas as datas de plantões daquela equipe APENAS no mês visível
      const { data: schedules, error: schedulesError } = await supabase
        .from("team_schedules")
        .select("shift_date, team_id")
        .eq("team_id", guardProfile.team_id)
        .gte("shift_date", format(start, "yyyy-MM-dd"))
        .lte("shift_date", format(end, "yyyy-MM-dd"))
        .order("shift_date", { ascending: true });

      console.log("[fetchGuardShiftDates] Schedules found:", schedules);

      if (schedulesError) {
        console.error("[fetchGuardShiftDates] Error fetching schedules:", schedulesError);
        setGuardShiftDates([]);
        return;
      }

      if (!schedules || schedules.length === 0) {
        console.log("[fetchGuardShiftDates] No schedules found for team in month");
        setGuardShiftDates([]);
        return;
      }

      // Conversão segura YYYY-MM-DD -> Date (sem problemas de fuso)
      const parseYmd = (ymd: string) => {
        const [y, m, d] = ymd.split("-").map(Number);
        return new Date(y, (m || 1) - 1, d || 1);
      };

      const dates = schedules.map((s) => parseYmd(s.shift_date));
      console.log("[fetchGuardShiftDates] Dates to highlight:", dates.map((d) => d.toISOString()));
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

    // Ordenar por nome do guarda em ordem alfabética
    const sorted = filtered.sort((a, b) => {
      const nameA = a.guard?.name || "Desconhecido";
      const nameB = b.guard?.name || "Desconhecido";
      return nameA.localeCompare(nameB, 'pt-BR');
    });

    setFilteredExtras(sorted);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AdminExtras] handleSubmit iniciado', { selectedGuard, extraDate, justification, quantity, profile });

    // Validações detalhadas
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

    if (!quantity || quantity < 1) {
      toast({
        variant: "destructive",
        title: "Quantidade inválida",
        description: "A quantidade de horas deve ser maior que zero.",
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
      const insertData = {
        guard_id: selectedGuard,
        extra_date: format(extraDate, "yyyy-MM-dd"),
        month_reference: format(startOfMonth(extraDate), "yyyy-MM-dd"),
        justification: justification.trim(),
        quantity,
        created_by: profile.id,
        admin_id: profile.id,
      };

      console.log('[AdminExtras] Inserindo dados:', insertData);

      const { data, error } = await supabase.from("extras").insert(insertData).select();

      if (error) {
        console.error('[AdminExtras] Erro ao inserir:', error);
        toast({
          variant: "destructive",
          title: "Erro ao cadastrar extra",
          description: error.message,
        });
        return;
      }

      console.log('[AdminExtras] Extra cadastrado com sucesso:', data);

      toast({
        title: "Extra cadastrado",
        description: "Plantão extra registrado com sucesso.",
      });

      // Reset form
      setSelectedGuard("");
      setExtraDate(undefined);
      setJustification("");
      setQuantity(1);
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
    // Adiciona T00:00:00 para interpretar como hora local, não UTC
    setEditDate(new Date(`${extra.extra_date}T00:00:00`));
    setEditJustification(extra.justification);
    setEditQuantity(extra.quantity);
  };

  const closeEditDialog = () => {
    setEditingExtra(null);
    setEditGuardId("");
    setEditDate(undefined);
    setEditJustification("");
    setEditQuantity(1);
  };

  const handleUpdate = async () => {
    if (!editingExtra || !editGuardId || !editDate || !editJustification || editQuantity < 1) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos corretamente.",
      });
      return;
    }

    const { error } = await supabase
      .from("extras")
      .update({
        guard_id: editGuardId,
        extra_date: format(editDate, "yyyy-MM-dd"),
        month_reference: format(startOfMonth(editDate), "yyyy-MM-dd"),
        justification: editJustification,
        quantity: editQuantity,
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
      if (filteredExtras.length === 0) {
        toast({
          variant: "destructive",
          title: "Sem dados",
          description: "Nenhum registro no período selecionado.",
        });
        return;
      }
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text("Relatório Mensal de Plantões Extras", 14, 20);
      
      doc.setFontSize(11);
      doc.text(`Período: ${format(filterMonth, "MMMM 'de' yyyy", { locale: ptBR })}`, 14, 30);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 36);

      // Summary
      doc.setFontSize(14);
      doc.text("Resumo", 14, 46);
      doc.setFontSize(10);
      const totalExtras = filteredExtras.reduce((sum, extra) => sum + (Number(extra.quantity) || 1), 0);
      doc.text(`Total de extras no período: ${totalExtras}`, 14, 52);

      // Table data - já ordenado alfabeticamente em applyFilters
      const tableData = filteredExtras.map(extra => [
        extra.guard?.name || "Desconhecido",
        (extra.quantity || 1).toString(),
        format(new Date(`${extra.extra_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR }),
        extra.justification,
      ]);

      autoTable(doc, {
        startY: 60,
        head: [["Segurança", "Quantidade", "Dia", "Fundamentação"]],
        body: tableData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25, halign: 'center' },
          2: { cellWidth: 30 },
          3: { cellWidth: 'auto' }
        }
      });

      // Footer
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

      doc.save(`relatorio-extras-${format(filterMonth, "MM-yyyy")}.pdf`);
      
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

  const generateRankingPDF = () => {
    try {
      if (rankingSummary.data.length === 0) {
        toast({
          variant: "destructive",
          title: "Sem dados",
          description: "Nenhum registro no período selecionado.",
        });
        return;
      }

      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(18);
      doc.text("Ranking de Plantões Extras", 14, 20);

      doc.setFontSize(11);
      doc.text(`Período: ${format(rankingDate, "MMMM 'de' yyyy", { locale: ptBR })}`, 14, 30);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 36);

      // Table data
      const tableData = rankingSummary.data.map((item, index) => [
        `${index + 1}º`,
        item.guardName,
        item.totalHours.toString()
      ]);

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

      // Footer
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

      doc.save(`ranking-extras-${format(rankingDate, "MM-yyyy")}.pdf`);
      
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

  const exportToCSV = () => {
    try {
      if (rankingSummary.data.length === 0) {
        toast({
          variant: "destructive",
          title: "Sem dados",
          description: "Nenhum registro no período selecionado.",
        });
        return;
      }

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += `Ranking de Plantões Extras\n`;
      csvContent += `Período: ${format(rankingDate, "MMMM 'de' yyyy", { locale: ptBR })}\n`;
      csvContent += `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
      csvContent += "Posição,Segurança,Total de Horas\n";

      rankingSummary.data.forEach((item, index) => {
        csvContent += `${index + 1},${item.guardName},${item.totalHours}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ranking-extras-${format(rankingDate, "MM-yyyy")}.csv`);
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


  return (
    <AppLayout title="Plantões Extras" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
      <div className="space-y-6">

      <Tabs defaultValue="register" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="register">Cadastro de Extras</TabsTrigger>
          <TabsTrigger value="ranking">
            <BarChart3 className="h-4 w-4 mr-2" />
            Ranking de Extras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="space-y-6">

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
                      onSelect={setExtraDate}
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
                <Label htmlFor="quantity">Horas de Extras Concedido *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  placeholder="1"
                />
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
          <CardTitle>Relatório Mensal</CardTitle>
          <CardDescription>Selecione o período e gere o relatório em PDF</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Período</Label>
              <div className="flex items-center justify-between gap-2 p-4 border rounded-lg bg-background">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFilterMonth(startOfMonth(subMonths(filterMonth, 1)))}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-center flex-1">
                  <p className="text-lg font-semibold capitalize">
                    {format(filterMonth, "MMMM yyyy", { locale: ptBR })}
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

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={generatePDF} variant="outline" className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                Gerar Relatório PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Mensal - Ranking de Extras</CardTitle>
          <CardDescription>
            Total de horas de extras por segurança no período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {extrasLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Posição</TableHead>
                    <TableHead>Segurança</TableHead>
                    <TableHead className="text-center">Total de Horas</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlySummary.map((item, index) => {
                    const guardExtras = filteredExtras.filter(e => e.guard_id === item.guardId);
                    return (
                      <TableRow key={item.guardId}>
                        <TableCell className="font-medium">{index + 1}º</TableCell>
                        <TableCell>{item.guardName}</TableCell>
                        <TableCell className="text-center font-semibold">{item.totalHours}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {guardExtras.length > 0 && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(guardExtras[0])}
                                  className="text-primary hover:text-primary"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeletingExtraId(guardExtras[0].id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                    <TableHead>Segurança</TableHead>
                    <TableHead className="text-center">Horas</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Fundamentação/Justificativa</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailsExtras.map((extra) => (
                    <TableRow key={extra.id}>
                      <TableCell className="font-medium">{extra.guard?.name || "Desconhecido"}</TableCell>
                      <TableCell className="text-center font-semibold">{extra.quantity}</TableCell>
                      <TableCell>{format(new Date(`${extra.extra_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="max-w-md">{extra.justification}</TableCell>
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
        </TabsContent>

        <TabsContent value="ranking" className="space-y-6">
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

                <div className="flex gap-2">
                  <Button onClick={generateRankingPDF} variant="outline" className="flex-1">
                    <FileText className="mr-2 h-4 w-4" />
                    Exportar PDF
                  </Button>
                  <Button onClick={exportToCSV} variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Exportar CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ranking Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Gráfico - Ranking de Extras</CardTitle>
              <CardDescription>Visualização comparativa de horas extras por segurança</CardDescription>
            </CardHeader>
            <CardContent>
              {extrasLoading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : rankingSummary.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado para o período selecionado.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={rankingSummary.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="guardName" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                      interval={0}
                    />
                    <YAxis label={{ value: 'Horas de Extras', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalHours" fill="hsl(var(--primary))" name="Total de Horas" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Ranking Table */}
          <Card>
            <CardHeader>
              <CardTitle>Tabela - Ranking de Extras</CardTitle>
              <CardDescription>
                {rankingSummary.data.length} {rankingSummary.data.length === 1 ? "segurança listado" : "seguranças listados"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {extrasLoading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : rankingSummary.data.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado para o período selecionado.
                </div>
              ) : (
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
                      {rankingSummary.data.map((item, index) => (
                        <TableRow key={item.guardId}>
                          <TableCell className="font-bold text-lg">
                            {index === 0 && "🥇 "}
                            {index === 1 && "🥈 "}
                            {index === 2 && "🥉 "}
                            {index + 1}º
                          </TableCell>
                          <TableCell className="font-medium">{item.guardName}</TableCell>
                          <TableCell className="text-center font-bold text-lg text-primary">
                            {item.totalHours}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                <Label htmlFor="edit-quantity">Horas de Extras Concedido *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  min="1"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
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
