import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Plus, UserPlus, CheckCircle, XCircle, Pencil, Trash2, Ban, CheckCircle2, Eye } from 'lucide-react';
import { format, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Admin {
  id: string;
  name: string;
  email: string;
  created_at: string;
  is_active: boolean;
  subscription?: {
    id: string;
    plan: {
      name: string;
      price: number;
    };
    end_date: string;
    status: string;
    payment_status: string;
  };
}

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_months: number;
}

export default function SuperAdminManagement() {
  const { profile } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [isAssignPlanOpen, setIsAssignPlanOpen] = useState(false);
  const [isEditAdminOpen, setIsEditAdminOpen] = useState(false);
  const [isGuardsOpen, setIsGuardsOpen] = useState(false);
  const [adminGuards, setAdminGuards] = useState<any[]>([]);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    is_active: true
  });
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // First, run the function to update admin statuses
      await supabase.rpc('suspend_expired_admins');

      // Fetch admin role user IDs
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      if (!adminRoles || adminRoles.length === 0) {
        setAdmins([]);
        setLoading(false);
        return;
      }

      const adminUserIds = adminRoles.map(r => r.user_id);

      // Fetch profiles for those user IDs
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', adminUserIds);

      if (profilesError) throw profilesError;

      // For each admin, fetch their subscription
      const adminsWithSubs = await Promise.all(
        (profiles || []).map(async (profile: any) => {
          const { data: subscription } = await supabase
            .from('admin_subscriptions')
            .select(`
              *,
              plan:subscription_plans(name, price)
            `)
            .eq('admin_id', profile.id)
            .eq('status', 'active')
            .maybeSingle();

          return {
            ...profile,
            subscription: subscription as any
          };
        })
      );

      setAdmins(adminsWithSubs);

      // Fetch active plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('active', true)
        .order('price');

      if (plansError) throw plansError;
      setPlans(plansData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-admin', {
        body: {
          email: adminForm.email,
          password: adminForm.password,
          name: adminForm.name,
          phone: adminForm.phone
        }
      });

      if (error) throw error;

      toast({
        title: 'Administrador criado',
        description: 'O administrador foi criado com sucesso.',
      });

      setIsCreateAdminOpen(false);
      setAdminForm({ name: '', email: '', phone: '', password: '' });
      fetchData();
    } catch (error: any) {
      console.error('Error creating admin:', error);
      toast({
        title: 'Erro ao criar administrador',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAssignPlan = async () => {
    if (!selectedAdmin || !selectedPlanId) return;

    try {
      const plan = plans.find(p => p.id === selectedPlanId);
      if (!plan) throw new Error('Plano não encontrado');

      const endDate = addMonths(new Date(), plan.duration_months);

      const { error } = await supabase
        .from('admin_subscriptions')
        .insert({
          admin_id: selectedAdmin.id,
          plan_id: selectedPlanId,
          end_date: endDate.toISOString(),
          status: 'active',
          payment_status: 'paid'
        });

      if (error) throw error;

      toast({
        title: 'Plano atribuído',
        description: 'O plano foi atribuído com sucesso ao administrador.',
      });

      setIsAssignPlanOpen(false);
      setSelectedAdmin(null);
      setSelectedPlanId('');
      fetchData();
    } catch (error: any) {
      console.error('Error assigning plan:', error);
      toast({
        title: 'Erro ao atribuir plano',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openAssignPlanDialog = (admin: Admin) => {
    setSelectedAdmin(admin);
    setIsAssignPlanOpen(true);
  };

  const openEditDialog = (admin: Admin) => {
    setSelectedAdmin(admin);
    setEditForm({
      name: admin.name,
      email: admin.email,
      is_active: admin.is_active
    });
    setIsEditAdminOpen(true);
  };

  const handleEditAdmin = async () => {
    if (!selectedAdmin) return;

    try {
      const { error } = await supabase.functions.invoke('update-admin', {
        body: {
          admin_id: selectedAdmin.id,
          name: editForm.name,
          email: editForm.email,
          is_active: editForm.is_active
        }
      });

      if (error) throw error;

      toast({
        title: 'Administrador atualizado',
        description: 'As informações foram atualizadas com sucesso.',
      });

      setIsEditAdminOpen(false);
      setSelectedAdmin(null);
      fetchData();
    } catch (error: any) {
      console.error('Error updating admin:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAdmin = async (admin: Admin) => {
    if (!confirm(`Tem certeza que deseja excluir o administrador ${admin.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('delete-admin', {
        body: {
          admin_id: admin.id
        }
      });

      if (error) throw error;

      toast({
        title: 'Administrador excluído',
        description: 'O administrador foi removido com sucesso.',
      });

      fetchData();
    } catch (error: any) {
      console.error('Error deleting admin:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (admin: Admin) => {
    try {
      const { error } = await supabase.functions.invoke('update-admin', {
        body: {
          admin_id: admin.id,
          is_active: !admin.is_active
        }
      });

      if (error) throw error;

      toast({
        title: admin.is_active ? 'Admin suspenso' : 'Admin ativado',
        description: `O administrador foi ${admin.is_active ? 'suspenso' : 'ativado'} com sucesso.`,
      });

      fetchData();
    } catch (error: any) {
      console.error('Error toggling active:', error);
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <AppLayout title="Gerenciar Administradores" user={{ name: profile?.name || 'Super Admin', role: 'ADMIN' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Gerenciar Administradores" user={{ name: profile?.name || 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Administradores</h2>
            <p className="text-muted-foreground">Gerencie os administradores e suas assinaturas</p>
          </div>
          <Dialog open={isCreateAdminOpen} onOpenChange={setIsCreateAdminOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Administrador
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Administrador</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Nome Completo *</Label>
                  <Input
                    id="admin-name"
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    placeholder="Nome do administrador"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email *</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-phone">WhatsApp (opcional)</Label>
                  <Input
                    id="admin-phone"
                    type="tel"
                    value={adminForm.phone}
                    onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                    placeholder="Ex: 11999999999"
                  />
                  <p className="text-xs text-muted-foreground">
                    Apenas números. Permite login com WhatsApp.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Senha *</Label>
                  <PasswordInput
                    id="admin-password"
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    placeholder="Senha inicial"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateAdminOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateAdmin}>
                  Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Administradores</CardTitle>
            <CardDescription>
              Total: {admins.length} administradores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status Plano</TableHead>
                  <TableHead>Status Acesso</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      {admin.subscription ? (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{admin.subscription.plan.name}</span>
                          <span className="text-xs text-muted-foreground">
                            R$ {admin.subscription.plan.price.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline">Sem plano</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {admin.subscription ? (
                        <Badge 
                          variant={admin.subscription.status === 'active' ? 'default' : 'secondary'}
                        >
                          {admin.subscription.status === 'active' ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Ativo
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Inativo
                            </>
                          )}
                        </Badge>
                      ) : (
                        <Badge variant="outline">-</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={admin.is_active ? 'default' : 'destructive'}
                      >
                        {admin.is_active ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ativo
                          </>
                        ) : (
                          <>
                            <Ban className="h-3 w-3 mr-1" />
                            Suspenso
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {admin.subscription ? (
                        <span className="text-sm">
                          {format(new Date(admin.subscription.end_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setSelectedAdmin(admin);
                            const { data } = await supabase
                              .from('profiles')
                              .select('*, team:teams(name, color)')
                              .eq('admin_id', admin.id)
                              .order('name');
                            setAdminGuards(data || []);
                            setIsGuardsOpen(true);
                          }}
                          title="Ver Seguranças"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssignPlanDialog(admin)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          {admin.subscription ? 'Renovar' : 'Atribuir'} Plano
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(admin)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(admin)}
                        >
                          {admin.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteAdmin(admin)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Admin Dialog */}
        <Dialog open={isEditAdminOpen} onOpenChange={setIsEditAdminOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Administrador</DialogTitle>
            </DialogHeader>
            {selectedAdmin && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="edit-active">Status Ativo</Label>
                  <input
                    id="edit-active"
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditAdminOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleEditAdmin}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Plan Dialog */}
        <Dialog open={isAssignPlanOpen} onOpenChange={setIsAssignPlanOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atribuir Plano</DialogTitle>
            </DialogHeader>
            {selectedAdmin && (
              <div className="space-y-4 py-4">
                <div className="rounded-lg bg-muted p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Administrador:</span>
                    <span className="font-medium">{selectedAdmin.name}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan-select">Selecionar Plano *</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - R$ {plan.price.toFixed(2)} ({plan.duration_months} {plan.duration_months === 1 ? 'mês' : 'meses'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignPlanOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAssignPlan}>
                Atribuir Plano
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Guards Dialog */}
        <Dialog open={isGuardsOpen} onOpenChange={setIsGuardsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Seguranças de {selectedAdmin?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {adminGuards.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Nenhum segurança encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminGuards.map((g: any) => (
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground text-center">Total: {adminGuards.length} seguranças</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}