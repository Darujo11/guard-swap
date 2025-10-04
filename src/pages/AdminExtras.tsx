import { useState, useEffect } from "react";
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
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, FileText, BarChart3, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Profile } from "@/lib/types";

interface Extra {
  id: string;
  guard_id: string;
  extra_date: string;
  month_reference: string;
  justification: string;
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
  const [monthReference, setMonthReference] = useState<Date>(new Date());
  const [justification, setJustification] = useState("");
  
  // Filter state
  const [filterGuard, setFilterGuard] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<Date>(new Date());

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
  }, [extras, filterGuard, filterMonth]);

  const fetchGuards = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*, user_roles!inner(role)")
      .eq("user_roles.role", "guard")
      .order("name");

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar seguranças",
        description: error.message,
      });
      return;
    }

    setGuards(data || []);
  };

  const fetchExtras = async () => {
    setExtrasLoading(true);
    const { data, error } = await supabase
      .from("extras")
      .select(`
        *,
        guard:profiles!extras_guard_id_fkey(*)
      `)
      .order("extra_date", { ascending: false });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao carregar extras",
        description: error.message,
      });
      setExtrasLoading(false);
      return;
    }

    setExtras(data || []);
    setExtrasLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...extras];

    if (filterGuard !== "all") {
      filtered = filtered.filter(extra => extra.guard_id === filterGuard);
    }

    const startMonth = startOfMonth(filterMonth);
    const endMonth = endOfMonth(filterMonth);
    filtered = filtered.filter(extra => {
      const extraMonth = new Date(extra.month_reference);
      return extraMonth >= startMonth && extraMonth <= endMonth;
    });

    setFilteredExtras(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGuard || !extraDate || !monthReference || !justification) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha todos os campos antes de cadastrar.",
      });
      return;
    }

    const { error } = await supabase.from("extras").insert({
      guard_id: selectedGuard,
      extra_date: format(extraDate, "yyyy-MM-dd"),
      month_reference: format(startOfMonth(monthReference), "yyyy-MM-dd"),
      justification,
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
    setMonthReference(new Date());
    setJustification("");
    
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

  const generateChartData = () => {
    const guardCounts: { [key: string]: number } = {};
    
    filteredExtras.forEach(extra => {
      const guardName = extra.guard?.name || "Desconhecido";
      guardCounts[guardName] = (guardCounts[guardName] || 0) + 1;
    });

    return Object.entries(guardCounts).map(([name, count]) => ({
      name,
      extras: count,
    }));
  };

  const generateMonthlyData = () => {
    const monthCounts: { [key: string]: number } = {};
    
    extras.forEach(extra => {
      const month = format(new Date(extra.month_reference), "MMM/yyyy", { locale: ptBR });
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });

    return Object.entries(monthCounts)
      .sort((a, b) => {
        const dateA = new Date(a[0].split("/").reverse().join("-"));
        const dateB = new Date(b[0].split("/").reverse().join("-"));
        return dateA.getTime() - dateB.getTime();
      })
      .map(([month, count]) => ({
        month,
        extras: count,
      }));
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text("Relatório de Plantões Extras", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Período: ${format(filterMonth, "MMMM 'de' yyyy", { locale: ptBR })}`, 14, 30);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 36);

    // Summary
    doc.setFontSize(14);
    doc.text("Resumo", 14, 46);
    doc.setFontSize(10);
    doc.text(`Total de extras no período: ${filteredExtras.length}`, 14, 52);

    // Table data
    const tableData = filteredExtras.map(extra => [
      extra.guard?.name || "Desconhecido",
      format(new Date(extra.extra_date), "dd/MM/yyyy", { locale: ptBR }),
      format(new Date(extra.month_reference), "MMM/yyyy", { locale: ptBR }),
      extra.justification,
    ]);

    autoTable(doc, {
      startY: 60,
      head: [["Segurança", "Data do Extra", "Mês Ref.", "Fundamentação"]],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Chart data summary
    const chartData = generateChartData();
    let finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(14);
    doc.text("Distribuição por Segurança", 14, finalY);
    
    finalY += 6;
    doc.setFontSize(10);
    chartData.forEach(item => {
      doc.text(`${item.name}: ${item.extras} extras`, 14, finalY);
      finalY += 6;
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
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Plantões Extras</h1>
          <p className="text-muted-foreground">Gerencie e visualize os plantões extras realizados</p>
        </div>
      </div>

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
                <Label>Mês de Referência *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(monthReference, "MMMM 'de' yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={monthReference}
                      onSelect={(date) => date && setMonthReference(date)}
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
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
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Segurança</Label>
              <Select value={filterGuard} onValueChange={setFilterGuard}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {guards.map(guard => (
                    <SelectItem key={guard.id} value={guard.id}>
                      {guard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                    onSelect={(date) => date && setFilterMonth(date)}
                    locale={ptBR}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Extras por Segurança
            </CardTitle>
            <CardDescription>Distribuição de plantões extras no período selecionado</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={generateChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="extras" fill="hsl(var(--primary))" name="Quantidade de Extras" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Evolução Mensal
            </CardTitle>
            <CardDescription>Quantidade de extras ao longo dos meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={generateMonthlyData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="extras" stroke="hsl(var(--primary))" name="Quantidade de Extras" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Extras Table */}
      <Card>
        <CardHeader>
          <CardTitle>Registros de Extras</CardTitle>
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
                    <TableHead>Data do Extra</TableHead>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead>Fundamentação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExtras.map((extra) => (
                    <TableRow key={extra.id}>
                      <TableCell className="font-medium">{extra.guard?.name}</TableCell>
                      <TableCell>{format(new Date(extra.extra_date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell>{format(new Date(extra.month_reference), "MMM/yyyy", { locale: ptBR })}</TableCell>
                      <TableCell className="max-w-md truncate">{extra.justification}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(extra.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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
    </div>
  );
}
