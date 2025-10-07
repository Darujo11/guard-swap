import { useState, useEffect } from 'react';
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
  Users, 
  Plus,
  Edit,
  Trash2,
  Search,
  UserPlus,
  Crown,
  GripVertical
} from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
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
              className="text-danger hover:text-danger"
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

const AdminTeams = () => {
  const { profile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isCreateMemberDialogOpen, setIsCreateMemberDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [activeMember, setActiveMember] = useState<Profile | null>(null);
  const [teamForm, setTeamForm] = useState({
    name: '',
    description: ''
  });
  const [memberForm, setMemberForm] = useState({
    name: '',
    phone: ''
  });
  const [memberTransfers, setMemberTransfers] = useState<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActiveMember(null);
      return;
    }

    const member = active.data.current?.member as Profile;
    const fromTeamId = active.data.current?.fromTeamId as string;
    const toTeamId = over.id as string;

    if (!member || fromTeamId === toTeamId) {
      setActiveMember(null);
      return;
    }

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
      console.error('[AdminTeams][DragEnd]', error);
      toast({
        title: 'Erro ao transferir',
        description: 'Não foi possível mover o membro para a nova equipe.',
        variant: 'destructive',
      });
    } finally {
      setActiveMember(null);
    }
  };

  const fetchData = async () => {
    try {
      const [teamsResult, profilesResult] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase
          .from('profiles')
          .select(`
            *,
            team:teams(*)
          `)
          .order('name')
      ]);

      if (teamsResult.error) throw teamsResult.error;
      if (profilesResult.error) throw profilesResult.error;

      setTeams(teamsResult.data || []);
      setProfiles((profilesResult.data || []) as Profile[]);
    } catch (error) {
      console.error('[AdminTeams][FetchData]', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as equipes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
      console.error('[AdminTeams][SaveTeam]', error);
      
      let errorMessage = 'Não foi possível salvar a equipe.';
      
      // Check for duplicate name error
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
    if (!confirm(`Tem certeza que deseja excluir a equipe "${team.name}"?`)) {
      return;
    }

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
      console.error('[AdminTeams][DeleteTeam]', error);
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
      // Criar segurança via Edge Function (usa Service Role e atribui papel)
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
      console.error('[AdminTeams][CreateMember]', error);
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
      console.error('[AdminTeams][AssignMember]', error);
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
      // Processar todas as transferências
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
      console.error('[AdminTeams][TransferMembers]', error);
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

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      description: team.description || ''
    });
    setIsTeamDialogOpen(true);
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTeamMembers = (teamId: string) => {
    return profiles.filter(profile => profile.team_id === teamId);
  };

  const unassignedMembers = profiles.filter(profile => !profile.team_id);

  if (loading) {
    return (
      <AppLayout title="Gerenciar Equipes" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando equipes...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Gerenciar Equipes" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
      <DndContext onDragEnd={handleDragEnd}>
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar equipes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
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

        {/* Teams Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => {
            const members = getTeamMembers(team.id);
            return (
              <DroppableTeamCard 
                key={team.id}
                team={team}
                members={members}
                onEdit={openEditDialog}
                onDelete={handleDeleteTeam}
                onAssign={(team) => {
                  setSelectedTeam(team);
                  setIsAssignDialogOpen(true);
                }}
              />
            );
          })}
        </div>

        {filteredTeams.length === 0 && (
          <Card className="text-center py-8">
            <CardContent>
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle className="mb-2">Nenhuma equipe encontrada</CardTitle>
              <CardDescription>
                {searchTerm
                  ? 'Nenhuma equipe corresponde aos critérios de busca.'
                  : 'Comece criando sua primeira equipe.'}
              </CardDescription>
            </CardContent>
          </Card>
        )}
      </DndContext>

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
    </AppLayout>
  );
};

export default AdminTeams;