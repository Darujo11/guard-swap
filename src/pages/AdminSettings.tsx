import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettings() {
  const { user, profile } = useAuth();
  const { settings, updateSettings, isUpdating } = useOrganizationSettings();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState(settings);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData, {
      onSuccess: () => {
        toast({
          title: 'Configurações salvas',
          description: 'As configurações foram atualizadas com sucesso.',
        });
      },
      onError: () => {
        toast({
          title: 'Erro ao salvar',
          description: 'Ocorreu um erro ao salvar as configurações.',
          variant: 'destructive',
        });
      },
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <AppLayout
      title="Configurações do Sistema"
      user={{
        name: profile?.name || 'Admin',
        role: 'ADMIN',
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Personalização de Termos
          </CardTitle>
          <CardDescription>
            Personalize os termos usados no sistema para adaptar a diferentes setores (segurança, enfermagem, educação, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Guard Labels */}
              <div className="space-y-2">
                <Label htmlFor="guard_label">Termo Singular (ex: Segurança)</Label>
                <Input
                  id="guard_label"
                  value={formData.guard_label}
                  onChange={(e) => handleChange('guard_label', e.target.value)}
                  placeholder="Segurança"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guards_label">Termo Plural (ex: Seguranças)</Label>
                <Input
                  id="guards_label"
                  value={formData.guards_label}
                  onChange={(e) => handleChange('guards_label', e.target.value)}
                  placeholder="Seguranças"
                />
              </div>

              {/* Team Labels */}
              <div className="space-y-2">
                <Label htmlFor="team_label">Grupo Singular (ex: Equipe)</Label>
                <Input
                  id="team_label"
                  value={formData.team_label}
                  onChange={(e) => handleChange('team_label', e.target.value)}
                  placeholder="Equipe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teams_label">Grupo Plural (ex: Equipes)</Label>
                <Input
                  id="teams_label"
                  value={formData.teams_label}
                  onChange={(e) => handleChange('teams_label', e.target.value)}
                  placeholder="Equipes"
                />
              </div>

              {/* Shift Labels */}
              <div className="space-y-2">
                <Label htmlFor="shift_label">Turno Singular (ex: Plantão)</Label>
                <Input
                  id="shift_label"
                  value={formData.shift_label}
                  onChange={(e) => handleChange('shift_label', e.target.value)}
                  placeholder="Plantão"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shifts_label">Turno Plural (ex: Plantões)</Label>
                <Input
                  id="shifts_label"
                  value={formData.shifts_label}
                  onChange={(e) => handleChange('shifts_label', e.target.value)}
                  placeholder="Plantões"
                />
              </div>

              {/* Schedule Labels */}
              <div className="space-y-2">
                <Label htmlFor="schedule_label">Agenda Singular (ex: Escala)</Label>
                <Input
                  id="schedule_label"
                  value={formData.schedule_label}
                  onChange={(e) => handleChange('schedule_label', e.target.value)}
                  placeholder="Escala"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedules_label">Agenda Plural (ex: Escalas)</Label>
                <Input
                  id="schedules_label"
                  value={formData.schedules_label}
                  onChange={(e) => handleChange('schedules_label', e.target.value)}
                  placeholder="Escalas"
                />
              </div>

              {/* Swap Labels */}
              <div className="space-y-2">
                <Label htmlFor="swap_label">Alteração Singular (ex: Troca)</Label>
                <Input
                  id="swap_label"
                  value={formData.swap_label}
                  onChange={(e) => handleChange('swap_label', e.target.value)}
                  placeholder="Troca"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="swaps_label">Alteração Plural (ex: Trocas)</Label>
                <Input
                  id="swaps_label"
                  value={formData.swaps_label}
                  onChange={(e) => handleChange('swaps_label', e.target.value)}
                  placeholder="Trocas"
                />
              </div>

              {/* Extra Labels */}
              <div className="space-y-2">
                <Label htmlFor="extra_label">Adicional Singular (ex: Extra)</Label>
                <Input
                  id="extra_label"
                  value={formData.extra_label}
                  onChange={(e) => handleChange('extra_label', e.target.value)}
                  placeholder="Extra"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="extras_label">Adicional Plural (ex: Extras)</Label>
                <Input
                  id="extras_label"
                  value={formData.extras_label}
                  onChange={(e) => handleChange('extras_label', e.target.value)}
                  placeholder="Extras"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
