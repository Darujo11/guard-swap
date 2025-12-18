import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CalendarOff, CalendarIcon, Plus, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';

interface Guard {
  id: string;
  name: string;
  email: string;
}

interface Leave {
  id: string;
  guard_id: string;
  admin_id: string | null;
  leave_type: string;
  custom_type: string | null;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
  guard?: Guard;
}

const LEAVE_TYPES = [
  { value: 'ATESTADO', label: 'Atestado Médico' },
  { value: 'FALTA_INJUSTIFICADA', label: 'Falta Injustificada' },
  { value: 'TRE', label: 'TRE (Justiça Eleitoral)' },
  { value: 'LICENCA_NOJO', label: 'Licença-Nojo' },
  { value: 'LICENCA_PATERNIDADE', label: 'Licença Paternidade' },
  { value: 'OUTRO', label: 'Outro' },
];

export default function AdminLeaves() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { settings } = useOrganizationSettings();

  const [guards, setGuards] = useState<Guard[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [selectedGuard, setSelectedGuard] = useState<string>('');
  const [leaveType, setLeaveType] = useState<string>('');
  const [customType, setCustomType] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState<string>('');

  // Edit dialog state
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Delete dialog state
  const [deleteLeaveId, setDeleteLeaveId] = useState<string | null>(null);

  // Filter state
  const [filterGuard, setFilterGuard] = useState<string>('all');

  useEffect(() => {
    if (profile?.id) {
      fetchGuards();
      fetchLeaves();
    }
  }, [profile?.id]);

  const fetchGuards = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('admin_id', profile!.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setGuards(data || []);
    } catch (error) {
      console.error('Error fetching guards:', error);
      toast({
        title: 'Erro',
        description: `Falha ao carregar ${settings.guards_label.toLowerCase()}.`,
        variant: 'destructive',
      });
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leaves')
        .select('*')
        .eq('admin_id', profile!.id)
        .order('start_date', { ascending: false });

      if (error) throw error;

      // Fetch guard names
      const guardIds = [...new Set((data || []).map(l => l.guard_id))];
      const { data: guardsData } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', guardIds);

      const guardsMap = new Map((guardsData || []).map(g => [g.id, g]));
      const leavesWithGuards = (data || []).map(leave => ({
        ...leave,
        guard: guardsMap.get(leave.guard_id),
      }));

      setLeaves(leavesWithGuards);
    } catch (error) {
      console.error('Error fetching leaves:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao carregar folgas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedGuard('');
    setLeaveType('');
    setCustomType('');
    setStartDate(undefined);
    setEndDate(undefined);
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGuard || !leaveType || !startDate || !endDate) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    if (endDate < startDate) {
      toast({
        title: 'Data inválida',
        description: 'A data final não pode ser anterior à data inicial.',
        variant: 'destructive',
      });
      return;
    }

    if (leaveType === 'OUTRO' && !customType.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Especifique o tipo de folga.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('leaves').insert({
        guard_id: selectedGuard,
        admin_id: profile!.id,
        leave_type: leaveType,
        custom_type: leaveType === 'OUTRO' ? customType.trim() : null,
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd'),
        notes: notes.trim() || null,
      });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Folga registrada com sucesso!',
      });

      resetForm();
      fetchLeaves();
    } catch (error) {
      console.error('Error creating leave:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao registrar folga.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (leave: Leave) => {
    setEditingLeave(leave);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!editingLeave) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('leaves')
        .update({
          guard_id: editingLeave.guard_id,
          leave_type: editingLeave.leave_type,
          custom_type: editingLeave.leave_type === 'OUTRO' ? editingLeave.custom_type : null,
          start_date: editingLeave.start_date,
          end_date: editingLeave.end_date,
          notes: editingLeave.notes,
        })
        .eq('id', editingLeave.id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Folga atualizada com sucesso!',
      });

      setEditDialogOpen(false);
      setEditingLeave(null);
      fetchLeaves();
    } catch (error) {
      console.error('Error updating leave:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar folga.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteLeaveId) return;

    try {
      const { error } = await supabase
        .from('leaves')
        .delete()
        .eq('id', deleteLeaveId);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Folga excluída com sucesso!',
      });

      setDeleteLeaveId(null);
      fetchLeaves();
    } catch (error) {
      console.error('Error deleting leave:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao excluir folga.',
        variant: 'destructive',
      });
    }
  };

  const getLeaveTypeLabel = (type: string, customType: string | null) => {
    if (type === 'OUTRO' && customType) {
      return customType;
    }
    return LEAVE_TYPES.find(t => t.value === type)?.label || type;
  };

  const calculateDays = (start: string, end: string) => {
    return differenceInDays(new Date(end), new Date(start)) + 1;
  };

  const filteredLeaves = filterGuard === 'all' 
    ? leaves 
    : leaves.filter(l => l.guard_id === filterGuard);

  return (
    <AppLayout
      title="Folgas"
      user={profile ? {
        name: profile.name,
        role: 'ADMIN',
      } : undefined}
    >
      <div className="space-y-6">
        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="h-5 w-5" />
              Registrar Nova Folga
            </CardTitle>
            <CardDescription>
              Registre afastamentos como atestados, faltas, licenças, etc.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Guard Selection */}
                <div className="space-y-2">
                  <Label>{settings.guard_label}</Label>
                  <Select value={selectedGuard} onValueChange={setSelectedGuard}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Selecione o ${settings.guard_label.toLowerCase()}`} />
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

                {/* Leave Type */}
                <div className="space-y-2">
                  <Label>Tipo de Folga</Label>
                  <Select value={leaveType} onValueChange={setLeaveType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Type (only when OUTRO is selected) */}
                <div className="space-y-2">
                  <Label>Especificar Tipo</Label>
                  <Input
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="Digite o tipo"
                    disabled={leaveType !== 'OUTRO'}
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Notes */}
                <div className="space-y-2 lg:col-span-1">
                  <Label>Observações (opcional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações adicionais"
                    rows={1}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>
                  <Plus className="h-4 w-4 mr-2" />
                  {submitting ? 'Registrando...' : 'Registrar Folga'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Leaves List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Folgas Registradas</CardTitle>
                <CardDescription>
                  Lista de todos os afastamentos registrados
                </CardDescription>
              </div>
              <div className="w-full sm:w-[200px]">
                <Select value={filterGuard} onValueChange={setFilterGuard}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por segurança" />
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
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma folga registrada.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{settings.guard_label}</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-center">Dias</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeaves.map(leave => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">
                          {leave.guard?.name || 'Desconhecido'}
                        </TableCell>
                        <TableCell>
                          {getLeaveTypeLabel(leave.leave_type, leave.custom_type)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(`${leave.start_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                          {leave.start_date !== leave.end_date && (
                            <> - {format(new Date(`${leave.end_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}</>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {calculateDays(leave.start_date, leave.end_date)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {leave.notes || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(leave)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteLeaveId(leave.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Folga</DialogTitle>
            <DialogDescription>
              Altere os dados da folga registrada.
            </DialogDescription>
          </DialogHeader>
          {editingLeave && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{settings.guard_label}</Label>
                <Select 
                  value={editingLeave.guard_id} 
                  onValueChange={(value) => setEditingLeave({...editingLeave, guard_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
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
                <Label>Tipo de Folga</Label>
                <Select 
                  value={editingLeave.leave_type} 
                  onValueChange={(value) => setEditingLeave({...editingLeave, leave_type: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editingLeave.leave_type === 'OUTRO' && (
                <div className="space-y-2">
                  <Label>Especificar Tipo</Label>
                  <Input
                    value={editingLeave.custom_type || ''}
                    onChange={(e) => setEditingLeave({...editingLeave, custom_type: e.target.value})}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(new Date(`${editingLeave.start_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(`${editingLeave.start_date}T00:00:00`)}
                        onSelect={(date) => date && setEditingLeave({
                          ...editingLeave, 
                          start_date: format(date, 'yyyy-MM-dd')
                        })}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(new Date(`${editingLeave.end_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(`${editingLeave.end_date}T00:00:00`)}
                        onSelect={(date) => date && setEditingLeave({
                          ...editingLeave, 
                          end_date: format(date, 'yyyy-MM-dd')
                        })}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={editingLeave.notes || ''}
                  onChange={(e) => setEditingLeave({...editingLeave, notes: e.target.value})}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSubmit} disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLeaveId} onOpenChange={() => setDeleteLeaveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Folga</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta folga? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
