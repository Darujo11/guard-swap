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
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, FileText, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [monthReference, setMonthReference] = useState<Date>(new Date());
  const [justification, setJustification] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  
  // Filter state
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
  }, [extras, filterMonth]);

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

  const groupedExtras = useMemo(() => {
    const map: Record<string, { guardName: string; total: number; days: string[] }> = {};
    filteredExtras.forEach((extra) => {
      const id = extra.guard_id;
      const name = extra.guard?.name || "Desconhecido";
      const qty = Number(extra.quantity) || 1;
      if (!map[id]) map[id] = { guardName: name, total: 0, days: [] };
      map[id].total += qty;
      map[id].days.push(format(new Date(extra.extra_date), "dd/MM", { locale: ptBR }));
    });
    return Object.entries(map).map(([guardId, v]) => ({ guardId, ...v }));
  }, [filteredExtras]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGuard || !extraDate || !monthReference || !justification || !quantity || quantity < 1) {
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
      month_reference: format(startOfMonth(monthReference), "yyyy-MM-dd"),
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
    setMonthReference(new Date());
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
                      onSelect={(date) => date && setMonthReference(startOfMonth(date))}
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
                <Label htmlFor="quantity">Quantidade de Extras *</Label>
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
                    <TableHead className="text-center">Quantidade</TableHead>
                    <TableHead>Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedExtras.map((group) => (
                    <TableRow key={group.guardId}>
                      <TableCell className="font-medium">{group.guardName}</TableCell>
                      <TableCell className="text-center font-semibold">{group.total}</TableCell>
                      <TableCell className="max-w-md">{group.days.join(", ")}</TableCell>
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
