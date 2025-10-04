import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, FileText, Trash2, Download, BarChart3 } from "lucide-react";
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
  
  // Filter state
  const [filterMonth, setFilterMonth] = useState<Date>(new Date());
  
  // Ranking filter state
  const [rankingPeriod, setRankingPeriod] = useState<"monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual">("monthly");
  const [rankingDate, setRankingDate] = useState<Date>(new Date());

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
    let startDate: Date;
    let endDate: Date;

    const year = rankingDate.getFullYear();
    const month = rankingDate.getMonth();

    switch (rankingPeriod) {
      case "monthly":
        startDate = startOfMonth(rankingDate);
        endDate = endOfMonth(rankingDate);
        break;
      case "bimonthly":
        const bimonth = Math.floor(month / 2);
        startDate = new Date(year, bimonth * 2, 1);
        endDate = endOfMonth(addMonths(startDate, 1));
        break;
      case "quarterly":
        const quarter = Math.floor(month / 3);
        startDate = new Date(year, quarter * 3, 1);
        endDate = endOfMonth(addMonths(startDate, 2));
        break;
      case "semiannual":
        const semester = Math.floor(month / 6);
        startDate = new Date(year, semester * 6, 1);
        endDate = endOfMonth(addMonths(startDate, 5));
        break;
      case "annual":
        startDate = startOfYear(rankingDate);
        endDate = endOfYear(rankingDate);
        break;
    }

    const periodExtras = extras.filter((extra) => {
      const extraDate = new Date(extra.extra_date);
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
  }, [guards, extras, rankingPeriod, rankingDate]);

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

  const applyFilters = () => {
    const targetKey = format(startOfMonth(filterMonth), "yyyy-MM");
    const filtered = extras.filter((extra) => {
      const extraKey = format(new Date(`${extra.month_reference}T00:00:00`), "yyyy-MM");
      return extraKey === targetKey;
    });

    setFilteredExtras(filtered);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGuard || !extraDate || !justification || !quantity || quantity < 1) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos e a quantidade deve ser maior que zero.",
      });
      return;
    }

    const { error } = await supabase.from("extras").insert({
      guard_id: selectedGuard,
      extra_date: format(extraDate, "yyyy-MM-dd"),
      month_reference: format(startOfMonth(extraDate), "yyyy-MM-dd"),
      justification,
      quantity,
      created_by: profile?.id,
    });

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
    setQuantity(1);
    
    fetchExtras();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro de extra?")) {
      return;
    }

    const { error } = await supabase.from("extras").delete().eq("id", id);

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

      // Table data
      const tableData = filteredExtras.map(extra => [
        extra.guard?.name || "Desconhecido",
        (extra.quantity || 1).toString(),
        format(new Date(extra.extra_date), "dd/MM/yyyy", { locale: ptBR }),
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
      
      const periodLabels = {
        monthly: "Mensal",
        bimonthly: "Bimestral",
        quarterly: "Trimestral",
        semiannual: "Semestral",
        annual: "Anual"
      };

      doc.setFontSize(11);
      doc.text(`Período: ${periodLabels[rankingPeriod]}`, 14, 30);
      doc.text(`De: ${format(rankingSummary.startDate, "dd/MM/yyyy", { locale: ptBR })} até ${format(rankingSummary.endDate, "dd/MM/yyyy", { locale: ptBR })}`, 14, 36);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 42);

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

      doc.save(`ranking-extras-${rankingPeriod}-${format(rankingDate, "MM-yyyy")}.pdf`);
      
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

      const periodLabels = {
        monthly: "Mensal",
        bimonthly: "Bimestral",
        quarterly: "Trimestral",
        semiannual: "Semestral",
        annual: "Anual"
      };

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += `Ranking de Plantões Extras - ${periodLabels[rankingPeriod]}\n`;
      csvContent += `Período: ${format(rankingSummary.startDate, "dd/MM/yyyy")} até ${format(rankingSummary.endDate, "dd/MM/yyyy")}\n`;
      csvContent += `Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
      csvContent += "Posição,Segurança,Total de Horas\n";

      rankingSummary.data.forEach((item, index) => {
        csvContent += `${index + 1},${item.guardName},${item.totalHours}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `ranking-extras-${rankingPeriod}-${format(rankingDate, "MM-yyyy")}.csv`);
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

  const getPeriodLabel = () => {
    const year = rankingDate.getFullYear();
    const month = rankingDate.getMonth();

    switch (rankingPeriod) {
      case "monthly":
        return format(rankingDate, "MMMM 'de' yyyy", { locale: ptBR });
      case "bimonthly":
        const bimonth = Math.floor(month / 2) + 1;
        return `${bimonth}º Bimestre de ${year}`;
      case "quarterly":
        const quarter = Math.floor(month / 3) + 1;
        return `${quarter}º Trimestre de ${year}`;
      case "semiannual":
        const semester = Math.floor(month / 6) + 1;
        return `${semester}º Semestre de ${year}`;
      case "annual":
        return `Ano de ${year}`;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Plantões Extras</h1>
          <p className="text-muted-foreground">Gerencie e visualize os plantões extras realizados</p>
        </div>
      </div>

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
                <Select value={selectedGuard} onValueChange={setSelectedGuard}>
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
                    />
                  </PopoverContent>
                </Popover>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(filterMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filterMonth}
                    onSelect={(date) => date && setFilterMonth(startOfMonth(date))}
                    locale={ptBR}
                    captionLayout="dropdown-buttons"
                    fromYear={2020}
                    toYear={2030}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlySummary.map((item, index) => (
                    <TableRow key={item.guardId}>
                      <TableCell className="font-medium">{index + 1}º</TableCell>
                      <TableCell>{item.guardName}</TableCell>
                      <TableCell className="text-center font-semibold">{item.totalHours}</TableCell>
                    </TableRow>
                  ))}
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
            {filteredExtras.length} {filteredExtras.length === 1 ? "registro encontrado" : "registros encontrados"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {extrasLoading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredExtras.length === 0 ? (
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
                  {filteredExtras.map((extra) => (
                    <TableRow key={extra.id}>
                      <TableCell className="font-medium">{extra.guard?.name || "Desconhecido"}</TableCell>
                      <TableCell className="text-center font-semibold">{extra.quantity}</TableCell>
                      <TableCell>{format(new Date(extra.extra_date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="max-w-md">{extra.justification}</TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(extra.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
              <CardDescription>Selecione o período para visualizar o ranking de extras</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={rankingPeriod} onValueChange={(value: any) => setRankingPeriod(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">📅 Mensal</SelectItem>
                      <SelectItem value="bimonthly">🗓️ Bimestral</SelectItem>
                      <SelectItem value="quarterly">📊 Trimestral</SelectItem>
                      <SelectItem value="semiannual">📆 Semestral</SelectItem>
                      <SelectItem value="annual">📈 Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data de Referência</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(rankingDate, "MMMM 'de' yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={rankingDate}
                        onSelect={(date) => date && setRankingDate(date)}
                        locale={ptBR}
                        captionLayout="dropdown-buttons"
                        fromYear={2020}
                        toYear={2030}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">Período Selecionado:</p>
                <p className="text-lg font-bold text-primary">{getPeriodLabel()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(rankingSummary.startDate, "dd/MM/yyyy")} até {format(rankingSummary.endDate, "dd/MM/yyyy")}
                </p>
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={generateRankingPDF} variant="outline" className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
                <Button onClick={exportToCSV} variant="outline" className="flex-1">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
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
    </div>
  );
}
