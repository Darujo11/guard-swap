import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Users, ArrowLeftRight, Clock, CalendarOff, Loader2, BarChart3 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AdminOption {
  id: string;
  name: string;
  email: string;
  user_id: string;
}

export default function SuperAdminReports() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  // Report data
  const [guards, setGuards] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);

  useEffect(() => {
    fetchAdmins();
  }, []);

  useEffect(() => {
    if (selectedAdminId) fetchReportData();
  }, [selectedAdminId]);

  const fetchAdmins = async () => {
    try {
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (!adminRoles?.length) { setLoadingAdmins(false); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email, user_id')
        .in('user_id', adminRoles.map(r => r.user_id));

      setAdmins(profiles || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar admins', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingAdmins(false);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [guardsRes, teamsRes, swapsRes, extrasRes, leavesRes] = await Promise.all([
        supabase.from('profiles').select('*, team:teams(name, color)').eq('admin_id', selectedAdminId).order('name'),
        supabase.from('teams').select('*').eq('admin_id', selectedAdminId).order('name'),
        supabase.from('swap_requests').select('*, requester:profiles!swap_requests_requester_id_fkey(name), target:profiles!swap_requests_target_id_fkey(name)').eq('admin_id', selectedAdminId).order('created_at', { ascending: false }),
        supabase.from('extras').select('*, guard:profiles!extras_guard_id_fkey(name)').eq('admin_id', selectedAdminId).order('extra_date', { ascending: false }),
        supabase.from('leaves').select('*, guard:profiles!leaves_guard_id_fkey(name)').eq('admin_id', selectedAdminId).order('start_date', { ascending: false }),
      ]);

      setGuards(guardsRes.data || []);
      setTeams(teamsRes.data || []);
      setSwaps(swapsRes.data || []);
      setExtras(extrasRes.data || []);
      setLeaves(leavesRes.data || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar dados', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectedAdmin = admins.find(a => a.id === selectedAdminId);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      PENDING: 'Pendente', ACCEPTED: 'Aceita', APPROVED: 'Aprovada',
      REJECTED: 'Rejeitada', CANCELLED: 'Cancelada', ACTIVE: 'Ativa',
      active: 'Ativo', approved: 'Aprovado'
    };
    return map[s] || s;
  };

  const generatePDF = () => {
    if (!selectedAdmin) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    let y = 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório Consolidado', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Administrador: ${selectedAdmin.name}`, 14, y);
    y += 7;
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, y);
    y += 12;

    // Summary
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo', 14, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Seguranças: ${guards.length}  |  Equipes: ${teams.length}  |  Trocas: ${swaps.length}  |  Extras: ${extras.length}  |  Afastamentos: ${leaves.length}`, 14, y);
    y += 12;

    // Swaps table
    if (swaps.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Trocas', 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [['Solicitante', 'Alvo', 'Data Sol.', 'Data Alvo', 'Status']],
        body: swaps.map(s => [
          s.requester?.name || '-',
          s.target?.name || '-',
          format(new Date(s.requester_shift_date), 'dd/MM/yyyy'),
          format(new Date(s.target_shift_date), 'dd/MM/yyyy'),
          statusLabel(s.status)
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Extras table
    if (extras.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text('Extras', 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [['Segurança', 'Data', 'Minutos', 'Justificativa']],
        body: extras.map(e => [
          e.guard?.name || '-',
          format(new Date(e.extra_date), 'dd/MM/yyyy'),
          `${e.minutes}min`,
          e.justification?.substring(0, 40) || '-'
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [39, 174, 96] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Leaves table
    if (leaves.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text('Afastamentos', 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [['Segurança', 'Tipo', 'Início', 'Fim', 'Status']],
        body: leaves.map(l => [
          l.guard?.name || '-',
          l.leave_type,
          format(new Date(l.start_date), 'dd/MM/yyyy'),
          format(new Date(l.end_date), 'dd/MM/yyyy'),
          statusLabel(l.status)
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [231, 76, 60] },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Guards table
    if (guards.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.text('Seguranças', 14, y);
      y += 2;
      autoTable(doc, {
        startY: y,
        head: [['Nome', 'Equipe', 'Status', 'Desde']],
        body: guards.map(g => [
          g.name,
          g.team?.name || '-',
          g.is_active ? 'Ativo' : 'Inativo',
          g.hire_date ? format(new Date(g.hire_date), 'dd/MM/yyyy') : '-'
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [142, 68, 173] },
      });
    }

    doc.save(`relatorio_${selectedAdmin.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);

    toast({ title: 'PDF gerado com sucesso!' });
  };

  return (
    <AppLayout title="Relatórios" user={{ name: profile?.name || 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6">
        {/* Admin selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Relatórios por Administrador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <div className="w-full sm:w-80 space-y-2">
                <label className="text-sm font-medium">Selecionar Administrador</label>
                <Select value={selectedAdminId} onValueChange={setSelectedAdminId}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingAdmins ? 'Carregando...' : 'Escolha um admin'} />
                  </SelectTrigger>
                  <SelectContent>
                    {admins.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedAdminId && !loading && (
                <Button onClick={generatePDF} variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Gerar PDF
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {selectedAdminId && !loading && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-2xl font-bold">{guards.length}</div>
                  <div className="text-xs text-muted-foreground">Seguranças</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-2xl font-bold">{teams.length}</div>
                  <div className="text-xs text-muted-foreground">Equipes</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <ArrowLeftRight className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-2xl font-bold">{swaps.length}</div>
                  <div className="text-xs text-muted-foreground">Trocas</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-2xl font-bold">{extras.length}</div>
                  <div className="text-xs text-muted-foreground">Extras</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <CalendarOff className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-2xl font-bold">{leaves.length}</div>
                  <div className="text-xs text-muted-foreground">Afastamentos</div>
                </CardContent>
              </Card>
            </div>

            {/* Swaps */}
            {swaps.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4" /> Trocas
                    <Badge variant="secondary" className="ml-2">{swaps.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Solicitante</TableHead>
                        <TableHead>Alvo</TableHead>
                        <TableHead>Data Sol.</TableHead>
                        <TableHead>Data Alvo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {swaps.slice(0, 50).map(s => (
                        <TableRow key={s.id}>
                          <TableCell>{s.requester?.name || '-'}</TableCell>
                          <TableCell>{s.target?.name || '-'}</TableCell>
                          <TableCell>{format(new Date(s.requester_shift_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{format(new Date(s.target_shift_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell><Badge variant="outline">{statusLabel(s.status)}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Extras */}
            {extras.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Extras
                    <Badge variant="secondary" className="ml-2">{extras.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segurança</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Minutos</TableHead>
                        <TableHead>Justificativa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extras.slice(0, 50).map(e => (
                        <TableRow key={e.id}>
                          <TableCell>{e.guard?.name || '-'}</TableCell>
                          <TableCell>{format(new Date(e.extra_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{e.minutes}min</TableCell>
                          <TableCell className="max-w-[200px] truncate">{e.justification || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Leaves */}
            {leaves.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CalendarOff className="h-4 w-4" /> Afastamentos
                    <Badge variant="secondary" className="ml-2">{leaves.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segurança</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.slice(0, 50).map(l => (
                        <TableRow key={l.id}>
                          <TableCell>{l.guard?.name || '-'}</TableCell>
                          <TableCell>{l.leave_type}</TableCell>
                          <TableCell>{format(new Date(l.start_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{format(new Date(l.end_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell><Badge variant="outline">{statusLabel(l.status)}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Guards */}
            {guards.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-4 w-4" /> Seguranças
                    <Badge variant="secondary" className="ml-2">{guards.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Desde</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guards.map(g => (
                        <TableRow key={g.id}>
                          <TableCell className="font-medium">{g.name}</TableCell>
                          <TableCell>
                            {g.team ? (
                              <Badge style={{ backgroundColor: g.team.color, color: '#fff' }}>{g.team.name}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={g.is_active ? 'default' : 'destructive'}>
                              {g.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell>{g.hire_date ? format(new Date(g.hire_date), 'dd/MM/yyyy') : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
