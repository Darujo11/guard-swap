import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TeamBadge } from '@/components/ui/team-badge';
import { useToast } from '@/hooks/use-toast';
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
  Phone
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AdminGuards = () => {
  const [guards, setGuards] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Profile | null>(null);
  const [guardForm, setGuardForm] = useState({
    name: '',
    email: '',
    phone: '',
    team_id: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

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
    if (!guardForm.name.trim() || !guardForm.email.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e email são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      
      // Create user in auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: guardForm.email,
        password: tempPassword,
        options: {
          data: {
            name: guardForm.name,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user');

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          name: guardForm.name,
          email: guardForm.email,
          phone: guardForm.phone || null,
          team_id: guardForm.team_id || null,
        });

      if (profileError) throw profileError;

      // Assign guard role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'guard',
        });

      if (roleError) throw roleError;

      toast({
        title: 'Segurança cadastrado',
        description: `${guardForm.name} foi cadastrado com sucesso. Senha temporária: ${tempPassword}`,
      });

      setIsCreateDialogOpen(false);
      setGuardForm({ name: '', email: '', phone: '', team_id: '' });
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
        })
        .eq('id', editingGuard.id);

      if (error) throw error;

      toast({
        title: 'Segurança atualizado',
        description: 'As informações foram atualizadas com sucesso.',
      });

      setIsEditDialogOpen(false);
      setEditingGuard(null);
      setGuardForm({ name: '', email: '', phone: '', team_id: '' });
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
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setGuardForm({ name: '', email: '', phone: '', team_id: '' });
    setEditingGuard(null);
  };

  const filteredGuards = guards.filter(guard =>
    guard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guard.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AppLayout title="Seguranças">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Gerenciar Seguranças">
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
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={guardForm.email}
                    onChange={(e) => setGuardForm({ ...guardForm, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    value={guardForm.phone}
                    onChange={(e) => setGuardForm({ ...guardForm, phone: e.target.value })}
                  />
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
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguranças Cadastrados
            </CardTitle>
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
                    <TableHead>Email</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuards.map((guard) => (
                    <TableRow key={guard.id}>
                      <TableCell className="font-medium">{guard.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {guard.email}
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
                          <Badge variant="outline">Sem equipe</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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

        {/* Edit Dialog */}
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
      </div>
    </AppLayout>
  );
};

export default AdminGuards;
