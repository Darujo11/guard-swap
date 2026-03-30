import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamBadge } from '@/components/ui/team-badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Team, Profile } from '@/lib/types';
import { 
  Shield, 
  Plus,
  Edit,
  Trash2,
  Search,
  UserPlus,
  Mail,
  Phone,
  Crown,
  FileText,
  Users,
  GripVertical,
  Calendar,
  Download,
  Loader2
} from 'lucide-react';
import { generateAllGuardsSchedulePDF } from '@/utils/pdfGenerator';
import { computeEffectiveSchedule } from '@/utils/effectiveSchedule';
import { GuardPersonalCalendar } from '@/components/schedule/GuardPersonalCalendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Component for draggable member
const DraggableMember = ({ member, teamId }: { member: Profile; teamId: string }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: member.id,
    data: { member, fromTeamId: teamId }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex flex-col gap-1 p-2 rounded cursor-move ${
        member.is_shift_chief 
          ? 'bg-amber-500/10 border border-amber-500/20' 
          : 'bg-muted/50'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          {member.is_shift_chief && (
            <Crown className="h-4 w-4 text-amber-500" />
          )}
          {member.name}
        </span>
      </div>
      {member.phone && (
        <span className="text-xs text-muted-foreground ml-8">
          WhatsApp: {member.phone}
        </span>
      )}
    </div>
  );
};

// Component for droppable team card
const DroppableTeamCard = ({ 
  team, 
  members, 
  onEdit, 
  onDelete, 
  onAssign 
}: { 
  team: Team; 
  members: Profile[]; 
  onEdit: (team: Team) => void; 
  onDelete: (team: Team) => void; 
  onAssign: (team: Team) => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: team.id,
    data: { team }
  });

  return (
    <Card 
      ref={setNodeRef}
      className={`hover:shadow-md transition-shadow ${isOver ? 'ring-2 ring-primary' : ''}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <TeamBadge team={team} />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAssign(team)}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(team)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(team)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardTitle className="text-lg">{team.name}</CardTitle>
        {team.description && (
          <CardDescription>{team.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Users className="h-4 w-4" />
          <span>{members.length} membros</span>
        </div>
        <div className="space-y-2 min-h-[60px]">
          {members.length > 0 ? (
            members.map((member) => (
              <DraggableMember key={member.id} member={member} teamId={team.id} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Nenhum membro atribuído
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const AdminGuards = () => {
  const { profile } = useAuth();
  const [guards, setGuards] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Profile | null>(null);
  const [selectedGuardForSchedule, setSelectedGuardForSchedule] = useState<Profile | null>(null);
  const [guardForm, setGuardForm] = useState({
    name: '',
    email: '',
    phone: '',
    team_id: '',
    is_shift_chief: false
  });
  
  // Team management states
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isCreateMemberDialogOpen, setIsCreateMemberDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({ name: '', description: '' });
  const [memberForm, setMemberForm] = useState({ name: '', phone: '' });
  const [memberTransfers, setMemberTransfers] = useState<Record<string, string>>({});
  const [generatingAllPDF, setGeneratingAllPDF] = useState(false);
  const [pdfMonth, setPdfMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const { toast } = useToast();

  const handleGenerateAllPDF = async () => {
    if (!profile?.id || guards.length === 0) return;
    setGeneratingAllPDF(true);
    try {
      const [year, month] = pdfMonth.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, 1);
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const endOfMonth = new Date(year, month, 0);
      const endStr = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
      const monthLabel = selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      // Fetch all data in parallel — query schedules by team_id (not admin_id) for reliability
      const teamIds = teams.map(t => t.id);
      const [schedulesRes, swapsRes, extrasRes, leavesRes] = await Promise.all([
        supabase.from('team_schedules').select('*').in('team_id', teamIds).gte('shift_date', startOfMonth).lte('shift_date', endStr),
        supabase.from('swap_requests').select('*, requester:profiles!swap_requests_requester_id_fkey(name, team_id), target:profiles!swap_requests_target_id_fkey(name, team_id)').eq('admin_id', profile.id).eq('status', 'APPROVED').or(`requester_shift_date.gte.${startOfMonth},target_shift_date.gte.${startOfMonth}`).or(`requester_shift_date.lte.${endStr},target_shift_date.lte.${endStr}`),
        supabase.from('extras').select('*').eq('admin_id', profile.id).gte('extra_date', startOfMonth).lte('extra_date', endStr),
        supabase.from('leaves').select('*').eq('admin_id', profile.id).eq('status', 'APPROVED'),
      ]);

      const schedules = schedulesRes.data || [];
      const swaps = swapsRes.data || [];
      const extras = extrasRes.data || [];
      const treLeaves = leavesRes.data || [];

      const allGuardsData: Array<{
        guardName: string;
        teamName: string;
        monthLabel: string;
        workingDays: Map<string, { teamName: string; teamColor: string; isSwapped: boolean; originalTeamName?: string; originalOwnerName?: string; originalDate?: string }>;
        extrasMap: Map<string, { justification: string; percentage_type: number }>;
        treDates: Map<string, string>;
      }> = [];

      for (const guard of guards) {
        const guardTeam = teams.find(t => t.id === guard.team_id);
        if (!guardTeam) continue;

        const effectiveDays = computeEffectiveSchedule(
          schedules,
          swaps as any,
          guard.id,
          guardTeam.id,
          guardTeam.color || '#3b82f6',
          guardTeam.name,
          teams.map(t => ({ id: t.id, name: t.name, color: t.color || '#3b82f6' }))
        );

        const workingDays = new Map<string, { teamName: string; teamColor: string; isSwapped: boolean; originalTeamName?: string; originalOwnerName?: string; originalDate?: string }>();
        effectiveDays.forEach((day, dateStr) => {
          if (dateStr >= startOfMonth && dateStr <= endStr) {
            workingDays.set(dateStr, {
              teamName: day.teamName,
              teamColor: day.teamColor,
              isSwapped: day.isSwapped,
              originalTeamName: day.originalTeamName,
              originalOwnerName: day.originalOwnerName,
              originalDate: day.originalDate,
            });
          }
        });

        const guardExtras = extras.filter(e => e.guard_id === guard.id);
        const extrasMap = new Map<string, { justification: string; percentage_type: number }>();
        guardExtras.forEach(e => extrasMap.set(e.extra_date, { justification: e.justification, percentage_type: e.percentage_type }));

        const guardTreLeaves = treLeaves.filter(l => l.guard_id === guard.id);
        const treDates = new Set<string>();
        guardTreLeaves.forEach(l => {
          const [sy, sm, sd] = l.start_date.split('-').map(Number);
          const [ey, em, ed] = l.end_date.split('-').map(Number);
          const start = new Date(sy, sm - 1, sd);
          const end = new Date(ey, em - 1, ed);
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (dateStr >= startOfMonth && dateStr <= endStr) {
              treDates.add(dateStr);
            }
          }
        });

        allGuardsData.push({
          guardName: guard.name,
          teamName: guardTeam.name,
          monthLabel,
          workingDays,
          extrasMap,
          treDates,
        });
      }

      if (allGuardsData.length === 0) {
        toast({ title: 'Nenhum segurança com equipe', variant: 'destructive' });
        return;
      }

      generateAllGuardsSchedulePDF(allGuardsData, monthLabel);
      toast({ title: 'PDF gerado com sucesso!' });
    } catch (error) {
      console.error('[AdminGuards][GenerateAllPDF]', error);
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    } finally {
      setGeneratingAllPDF(false);
    }
  };

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;
    try {
      const [teamsResult, profilesResult] = await Promise.all([
        supabase.from('teams').select('*').eq('admin_id', profile.id).order('name'),
        supabase
          .from('profiles')
          .select(`
            *,
            team:teams(*)
          `)
          .eq('admin_id', profile.id)
          .order('name')
      ]);

      if (teamsResult.error) throw teamsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      setTeams(teamsResult.data || []);
      setGuards((profilesResult.data || []) as Profile[]);
    } catch (error) {
      console.error('[AdminGuards][FetchData]', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar os seguranças.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGuard = async () => {
    if (!guardForm.name.trim() || !guardForm.phone.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e WhatsApp são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-guard', {
        body: {
          name: guardForm.name,
          email: guardForm.email || null,
          phone: guardForm.phone,
          team_id: guardForm.team_id || null,
          is_shift_chief: guardForm.is_shift_chief || false,
          admin_id: profile?.id || null,
        }
      });

      if (error) throw error;

      toast({
        title: 'Segurança cadastrado com sucesso!',
        description: `Login: ${guardForm.phone}\nSenha: 123456`,
        duration: 8000,
      });

      setIsCreateDialogOpen(false);
      setGuardForm({ name: '', email: '', phone: '', team_id: '', is_shift_chief: false });
      fetchData();
    } catch (error: any) {
      console.error('[AdminGuards][CreateGuard]', error);
      toast({
        title: 'Erro ao cadastrar',
        description: error.message || 'Não foi possível cadastrar o segurança.',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateGuard = async () => {
    if (!editingGuard || !guardForm.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'O nome é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: guardForm.name,
          phone: guardForm.phone || null,
          team_id: guardForm.team_id || null,
          is_shift_chief: guardForm.is_shift_chief || false,
        })
        .eq('id', editingGuard.id);

      if (error) throw error;

      toast({
        title: 'Segurança atualizado',
        description: 'As informações foram atualizadas com sucesso.',
      });

      setIsEditDialogOpen(false);
      setEditingGuard(null);
      setGuardForm({ name: '', email: '', phone: '', team_id: '', is_shift_chief: false });
      fetchData();
    } catch (error: any) {
      console.error('[AdminGuards][UpdateGuard]', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message || 'Não foi possível atualizar o segurança.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteGuard = async (guard: Profile) => {
    if (!confirm(`Tem certeza que deseja remover ${guard.name}?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', guard.id);

      if (error) throw error;

      toast({
        title: 'Segurança removido',
        description: `${guard.name} foi removido com sucesso.`,
      });

      fetchData();
    } catch (error: any) {
      console.error('[AdminGuards][DeleteGuard]', error);
      toast({
        title: 'Erro ao remover',
        description: error.message || 'Não foi possível remover o segurança.',
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (guard: Profile) => {
    setEditingGuard(guard);
    setGuardForm({
      name: guard.name,
      email: guard.email,
      phone: guard.phone || '',
      team_id: guard.team_id || '',
      is_shift_chief: guard.is_shift_chief || false,
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setGuardForm({ name: '', email: '', phone: '', team_id: '', is_shift_chief: false });
    setEditingGuard(null);
  };

  // Team management functions
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const member = active.data.current?.member as Profile;
    const fromTeamId = active.data.current?.fromTeamId as string;
    const toTeamId = over.id as string;

    if (!member || fromTeamId === toTeamId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: toTeamId })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: 'Membro transferido',
        description: `${member.name} foi movido para a nova equipe com sucesso.`,
      });

      await fetchData();
    } catch (error) {
      console.error('[AdminGuards][DragEnd]', error);
      toast({
        title: 'Erro ao transferir',
        description: 'Não foi possível mover o membro para a nova equipe.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveTeam = async () => {
    if (!teamForm.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'O nome da equipe é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingTeam) {
        const { error } = await supabase
          .from('teams')
          .update(teamForm)
          .eq('id', editingTeam.id);

        if (error) throw error;

        toast({
          title: 'Equipe atualizada',
          description: 'A equipe foi atualizada com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('teams')
          .insert([{
            ...teamForm,
            admin_id: profile?.id || null
          }]);

        if (error) throw error;

        toast({
          title: 'Equipe criada',
          description: 'A equipe foi criada com sucesso.',
        });
      }

      await fetchData();
      setIsTeamDialogOpen(false);
      resetTeamForm();
    } catch (error: any) {
      console.error('[AdminGuards][SaveTeam]', error);
      
      let errorMessage = 'Não foi possível salvar a equipe.';
      if (error?.message?.includes('duplicate key') || error?.code === '23505') {
        errorMessage = 'Já existe uma equipe com este nome. Por favor, escolha outro nome.';
      }
      
      toast({
        title: 'Erro ao salvar',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!confirm(`Tem certeza que deseja excluir a equipe "${team.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);

      if (error) throw error;

      toast({
        title: 'Equipe excluída',
        description: 'A equipe foi excluída com sucesso.',
      });

      await fetchData();
    } catch (error) {
      console.error('[AdminGuards][DeleteTeam]', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a equipe.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateMember = async () => {
    if (!selectedTeam) return;
    
    if (!memberForm.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'O nome do membro é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    if (!memberForm.phone.trim()) {
      toast({
        title: 'WhatsApp obrigatório',
        description: 'O número do WhatsApp é obrigatório.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const phoneClean = memberForm.phone.replace(/\D/g, '');

      const { data, error } = await supabase.functions.invoke('create-guard', {
        body: {
          name: memberForm.name,
          email: null,
          phone: phoneClean,
          team_id: selectedTeam.id,
          admin_id: profile?.id || null,
        },
      });

      if (error) throw new Error(error.message || 'Falha ao criar segurança');

      toast({
        title: 'Sucesso!',
        description: `Membro criado! Login: ${data?.login ?? phoneClean} | Senha: ${data?.password ?? '123456'}`,
      });

      await fetchData();
      setIsCreateMemberDialogOpen(false);
      setMemberForm({ name: '', phone: '' });
    } catch (error: any) {
      console.error('[AdminGuards][CreateMember]', error);
      toast({
        title: 'Erro ao criar membro',
        description: error.message || 'Não foi possível criar o membro.',
        variant: 'destructive',
      });
    }
  };

  const handleAssignMember = async (profileId: string) => {
    if (!selectedTeam) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: selectedTeam.id })
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: 'Membro atribuído',
        description: 'O membro foi atribuído à equipe com sucesso.',
      });

      await fetchData();
      setIsAssignDialogOpen(false);
    } catch (error) {
      console.error('[AdminGuards][AssignMember]', error);
      toast({
        title: 'Erro ao atribuir',
        description: 'Não foi possível atribuir o membro à equipe.',
        variant: 'destructive',
      });
    }
  };

  const handleTransferMembers = async () => {
    if (!selectedTeam || Object.keys(memberTransfers).length === 0) return;

    try {
      const promises = Object.entries(memberTransfers).map(([memberId, newTeamId]) => {
        return supabase
          .from('profiles')
          .update({ team_id: newTeamId === 'unassigned' ? null : newTeamId })
          .eq('id', memberId);
      });

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error('Algumas transferências falharam');
      }

      toast({
        title: 'Transferências concluídas',
        description: `${Object.keys(memberTransfers).length} membro(s) transferido(s) com sucesso.`,
      });

      setMemberTransfers({});
      await fetchData();
    } catch (error) {
      console.error('[AdminGuards][TransferMembers]', error);
      toast({
        title: 'Erro ao transferir',
        description: 'Não foi possível transferir todos os membros.',
        variant: 'destructive',
      });
    }
  };

  const resetTeamForm = () => {
    setTeamForm({ name: '', description: '' });
    setEditingTeam(null);
  };

  const openTeamEditDialog = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      description: team.description || ''
    });
    setIsTeamDialogOpen(true);
  };

  const filteredGuards = guards.filter(guard =>
    guard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guard.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(teamSearchTerm.toLowerCase())
  );

  const getTeamMembers = (teamId: string) => {
    return guards.filter(guard => guard.team_id === teamId);
  };

  const unassignedMembers = guards.filter(guard => !guard.team_id);

  if (loading) {
    return (
      <AppLayout title="Seguranças" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Gerenciar Seguranças" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar seguranças..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetForm}>
                <Plus className="h-4 w-4" />
                Novo Segurança
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Segurança</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    placeholder="Digite o nome completo"
                    value={guardForm.name}
                    onChange={(e) => setGuardForm({ ...guardForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com (opcional)"
                    value={guardForm.email}
                    onChange={(e) => setGuardForm({ ...guardForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp (será usado como login) *</Label>
                  <Input
                    id="phone"
                    placeholder="11999999999 (apenas números)"
                    value={guardForm.phone}
                    onChange={(e) => setGuardForm({ ...guardForm, phone: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Este número será usado como login. Senha padrão: 123456
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team">Equipe (opcional)</Label>
                  <Select
                    value={guardForm.team_id || undefined}
                    onValueChange={(value) => setGuardForm({ ...guardForm, team_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma equipe (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_shift_chief"
                    checked={guardForm.is_shift_chief}
                    onCheckedChange={(checked) => 
                      setGuardForm({ ...guardForm, is_shift_chief: checked as boolean })
                    }
                  />
                  <Label htmlFor="is_shift_chief" className="flex items-center gap-2 cursor-pointer">
                    <Crown className="h-4 w-4 text-amber-500" />
                    Chefe de Plantão
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateGuard}>
                  Cadastrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Guards List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Seguranças
              </CardTitle>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  value={pdfMonth}
                  onChange={(e) => setPdfMonth(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAllPDF}
                  disabled={generatingAllPDF || guards.length === 0}
                >
                  {generatingAllPDF ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Gerar PDF de Todos
                </Button>
              </div>
            </div>
            <CardDescription>
              Total: {filteredGuards.length} seguranças
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredGuards.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum segurança encontrado.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuards.map((guard) => (
                    <TableRow key={guard.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {guard.is_shift_chief && <Crown className="h-4 w-4 text-amber-500" />}
                          {guard.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {guard.phone ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {guard.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {guard.team ? (
                          <TeamBadge team={guard.team} />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedGuardForSchedule(guard)}
                            title="Ver Escala"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <Link to={`/admin/ficha/${guard.id}`}>
                              <FileText className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(guard)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteGuard(guard)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Escala do Segurança */}
        <Dialog open={selectedGuardForSchedule !== null} onOpenChange={(open) => { if (!open) setSelectedGuardForSchedule(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Escala de {selectedGuardForSchedule?.name}</DialogTitle>
            </DialogHeader>
            {selectedGuardForSchedule && (
              <GuardPersonalCalendar
                guardId={selectedGuardForSchedule.id}
                teamId={selectedGuardForSchedule.team_id || null}
                teamColor={selectedGuardForSchedule.team?.color || '#6B7280'}
                teamName={selectedGuardForSchedule.team?.name || 'Sem equipe'}
                guardName={selectedGuardForSchedule.name}
              />
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Equipes
                </CardTitle>
                <CardDescription>
                  Arraste os membros entre equipes para transferi-los
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar equipes..."
                    value={teamSearchTerm}
                    onChange={(e) => setTeamSearchTerm(e.target.value)}
                    className="pl-10 w-[200px]"
                  />
                </div>
                <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetTeamForm}>
                      <Plus className="h-4 w-4 mr-2" />
                      Nova Equipe
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingTeam ? 'Editar Equipe' : 'Nova Equipe'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="teamName">Nome da Equipe</Label>
                        <Input
                          id="teamName"
                          value={teamForm.name}
                          onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                          placeholder="Ex: Equipe A"
                        />
                      </div>
                      <div>
                        <Label htmlFor="teamDescription">Descrição</Label>
                        <Textarea
                          id="teamDescription"
                          value={teamForm.description}
                          onChange={(e) => setTeamForm({ ...teamForm, description: e.target.value })}
                          placeholder="Descrição opcional da equipe"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsTeamDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveTeam}>
                        {editingTeam ? 'Atualizar' : 'Criar'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DndContext onDragEnd={handleDragEnd}>
              {filteredTeams.length > 0 ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTeams.map((team) => {
                    const members = getTeamMembers(team.id);
                    return (
                      <DroppableTeamCard 
                        key={team.id}
                        team={team}
                        members={members}
                        onEdit={openTeamEditDialog}
                        onDelete={handleDeleteTeam}
                        onAssign={(team) => {
                          setSelectedTeam(team);
                          setIsAssignDialogOpen(true);
                        }}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{teamSearchTerm ? 'Nenhuma equipe encontrada.' : 'Nenhuma equipe cadastrada.'}</p>
                </div>
              )}
            </DndContext>
          </CardContent>
        </Card>

        {/* Edit Guard Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Segurança</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome Completo *</Label>
                <Input
                  id="edit-name"
                  placeholder="Digite o nome completo"
                  value={guardForm.name}
                  onChange={(e) => setGuardForm({ ...guardForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={guardForm.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone</Label>
                <Input
                  id="edit-phone"
                  placeholder="(00) 00000-0000"
                  value={guardForm.phone}
                  onChange={(e) => setGuardForm({ ...guardForm, phone: e.target.value })}
                />
              </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-team">Equipe (opcional)</Label>
                  <Select
                    value={guardForm.team_id || undefined}
                    onValueChange={(value) => setGuardForm({ ...guardForm, team_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma equipe (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit_is_shift_chief"
                    checked={guardForm.is_shift_chief}
                    onCheckedChange={(checked) => 
                      setGuardForm({ ...guardForm, is_shift_chief: checked as boolean })
                    }
                  />
                  <Label htmlFor="edit_is_shift_chief" className="flex items-center gap-2 cursor-pointer">
                    <Crown className="h-4 w-4 text-amber-500" />
                    Chefe de Plantão
                  </Label>
                </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateGuard}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Member Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={(open) => {
          setIsAssignDialogOpen(open);
          if (!open) setMemberTransfers({});
        }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Gerenciar Membros - {selectedTeam?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Membros Atuais da Equipe */}
              {selectedTeam && getTeamMembers(selectedTeam.id).length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Membros Atuais</h4>
                    <Badge variant="secondary">
                      {getTeamMembers(selectedTeam.id).length} membro(s)
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {getTeamMembers(selectedTeam.id).map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{member.name}</span>
                            {member.is_shift_chief && (
                              <Crown className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          {member.phone && (
                            <div className="text-xs text-muted-foreground">
                              WhatsApp: {member.phone}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={memberTransfers[member.id] || selectedTeam.id}
                            onValueChange={(value) => {
                              if (value === selectedTeam.id) {
                                const newTransfers = { ...memberTransfers };
                                delete newTransfers[member.id];
                                setMemberTransfers(newTransfers);
                              } else {
                                setMemberTransfers({
                                  ...memberTransfers,
                                  [member.id]: value
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={selectedTeam.id}>
                                {selectedTeam.name} (atual)
                              </SelectItem>
                              <SelectItem value="unassigned">
                                Sem equipe
                              </SelectItem>
                              {teams
                                .filter(t => t.id !== selectedTeam.id)
                                .map(team => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                  </SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                  {Object.keys(memberTransfers).length > 0 && (
                    <Button 
                      onClick={handleTransferMembers}
                      className="w-full"
                    >
                      Confirmar Transferências ({Object.keys(memberTransfers).length})
                    </Button>
                  )}
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Adicionar membros
                  </span>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => {
                  setIsAssignDialogOpen(false);
                  setIsCreateMemberDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Novo Membro
              </Button>

              {/* Membros Não Atribuídos */}
              {unassignedMembers.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Membros Sem Equipe</h4>
                  <div className="space-y-2">
                    {unassignedMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-sm text-muted-foreground">{member.email}</div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAssignMember(member.id)}
                        >
                          Atribuir
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Member Dialog */}
        <Dialog open={isCreateMemberDialogOpen} onOpenChange={setIsCreateMemberDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Cadastrar Novo Membro - {selectedTeam?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="memberName">Nome Completo</Label>
                <Input
                  id="memberName"
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <Label htmlFor="memberPhone">WhatsApp</Label>
                <Input
                  id="memberPhone"
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                  placeholder="Ex: (11) 98765-4321"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCreateMemberDialogOpen(false);
                  setIsAssignDialogOpen(true);
                }}
              >
                Voltar
              </Button>
              <Button onClick={handleCreateMember}>
                Cadastrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminGuards;
