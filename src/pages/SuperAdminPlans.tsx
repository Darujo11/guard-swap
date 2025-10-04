import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit, Trash2, DollarSign, Users, Calendar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_months: number;
  max_guards: number | null;
  max_teams: number | null;
  features: any;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    price: '',
    duration_months: '',
    max_guards: '',
    max_teams: '',
    features: '',
    active: true
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Erro ao carregar planos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const planData = {
        name: planForm.name,
        description: planForm.description,
        price: parseFloat(planForm.price),
        duration_months: parseInt(planForm.duration_months),
        max_guards: planForm.max_guards ? parseInt(planForm.max_guards) : null,
        max_teams: planForm.max_teams ? parseInt(planForm.max_teams) : null,
        features: planForm.features ? JSON.parse(planForm.features) : [],
        active: planForm.active
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;

        toast({
          title: 'Plano atualizado',
          description: 'O plano foi atualizado com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert([planData]);

        if (error) throw error;

        toast({
          title: 'Plano criado',
          description: 'O plano foi criado com sucesso.',
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchPlans();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast({
        title: 'Erro ao salvar plano',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return;

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      toast({
        title: 'Plano excluído',
        description: 'O plano foi excluído com sucesso.',
      });

      fetchPlans();
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast({
        title: 'Erro ao excluir plano',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description || '',
      price: plan.price.toString(),
      duration_months: plan.duration_months.toString(),
      max_guards: plan.max_guards?.toString() || '',
      max_teams: plan.max_teams?.toString() || '',
      features: JSON.stringify(plan.features, null, 2),
      active: plan.active
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setPlanForm({
      name: '',
      description: '',
      price: '',
      duration_months: '',
      max_guards: '',
      max_teams: '',
      features: '',
      active: true
    });
    setEditingPlan(null);
  };

  if (loading) {
    return (
      <AppLayout title="Gerenciar Planos" user={{ name: 'Super Admin', role: 'ADMIN' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Gerenciar Planos" user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Planos de Assinatura</h2>
            <p className="text-muted-foreground">Gerencie os planos disponíveis para venda</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Plano *</Label>
                    <Input
                      id="name"
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      placeholder="Ex: Plano Mensal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço (R$) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={planForm.price}
                      onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                      placeholder="99.90"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                    placeholder="Descrição do plano"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duração (meses) *</Label>
                    <Input
                      id="duration"
                      type="number"
                      value={planForm.duration_months}
                      onChange={(e) => setPlanForm({ ...planForm, duration_months: e.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_guards">Máx. Seguranças</Label>
                    <Input
                      id="max_guards"
                      type="number"
                      value={planForm.max_guards}
                      onChange={(e) => setPlanForm({ ...planForm, max_guards: e.target.value })}
                      placeholder="Ilimitado"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_teams">Máx. Equipes</Label>
                    <Input
                      id="max_teams"
                      type="number"
                      value={planForm.max_teams}
                      onChange={(e) => setPlanForm({ ...planForm, max_teams: e.target.value })}
                      placeholder="Ilimitado"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="features">Funcionalidades (JSON) *</Label>
                  <Textarea
                    id="features"
                    value={planForm.features}
                    onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                    placeholder='["Gestão de escalas", "Trocas de plantão"]'
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite as funcionalidades em formato JSON de array
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={planForm.active}
                    onCheckedChange={(checked) => setPlanForm({ ...planForm, active: checked })}
                  />
                  <Label htmlFor="active">Plano ativo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingPlan ? 'Atualizar' : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {plan.name}
                      {!plan.active && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-2">{plan.description}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(plan)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(plan.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    R$ {plan.price.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">
                    /{plan.duration_months === 1 ? 'mês' : `${plan.duration_months} meses`}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                      {plan.max_guards ? `Até ${plan.max_guards} seguranças` : 'Seguranças ilimitados'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      {plan.max_teams ? `Até ${plan.max_teams} equipes` : 'Equipes ilimitadas'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <p className="text-sm font-medium">Funcionalidades:</p>
                  <ul className="space-y-1">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}