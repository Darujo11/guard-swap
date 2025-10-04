import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings';
import { useToast } from '@/hooks/use-toast';

export default function AdminSettings() {
  const { profile } = useAuth();
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
          title: 'Sucesso',
          description: 'Configurações atualizadas com sucesso!',
        });
      },
      onError: (error) => {
        toast({
          title: 'Erro',
          description: 'Falha ao atualizar configurações.',
          variant: 'destructive',
        });
        console.error(error);
      },
    });
  };

  return (
    <AppLayout
      title="Configurações da Organização"
      user={profile ? {
        name: profile.name,
        role: 'ADMIN',
      } : undefined}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Personalizar Terminologia
          </CardTitle>
          <CardDescription>
            Adapte os termos do sistema para o seu setor (hospitais, escolas, empresas, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profissional (Singular) */}
              <div className="space-y-2">
                <Label htmlFor="guard_label">Profissional (Singular)</Label>
                <Input
                  id="guard_label"
                  value={formData.guard_label}
                  onChange={(e) => setFormData({ ...formData, guard_label: e.target.value })}
                  placeholder="Ex: Segurança, Enfermeiro, Professor"
                />
              </div>

              {/* Profissionais (Plural) */}
              <div className="space-y-2">
                <Label htmlFor="guards_label">Profissionais (Plural)</Label>
                <Input
                  id="guards_label"
                  value={formData.guards_label}
                  onChange={(e) => setFormData({ ...formData, guards_label: e.target.value })}
                  placeholder="Ex: Seguranças, Enfermeiros, Professores"
                />
              </div>

              {/* Equipe (Singular) */}
              <div className="space-y-2">
                <Label htmlFor="team_label">Equipe (Singular)</Label>
                <Input
                  id="team_label"
                  value={formData.team_label}
                  onChange={(e) => setFormData({ ...formData, team_label: e.target.value })}
                  placeholder="Ex: Equipe, Turma, Setor"
                />
              </div>

              {/* Equipes (Plural) */}
              <div className="space-y-2">
                <Label htmlFor="teams_label">Equipes (Plural)</Label>
                <Input
                  id="teams_label"
                  value={formData.teams_label}
                  onChange={(e) => setFormData({ ...formData, teams_label: e.target.value })}
                  placeholder="Ex: Equipes, Turmas, Setores"
                />
              </div>

              {/* Plantão (Singular) */}
              <div className="space-y-2">
                <Label htmlFor="shift_label">Turno/Plantão (Singular)</Label>
                <Input
                  id="shift_label"
                  value={formData.shift_label}
                  onChange={(e) => setFormData({ ...formData, shift_label: e.target.value })}
                  placeholder="Ex: Plantão, Turno, Período"
                />
              </div>

              {/* Plantões (Plural) */}
              <div className="space-y-2">
                <Label htmlFor="shifts_label">Turnos/Plantões (Plural)</Label>
                <Input
                  id="shifts_label"
                  value={formData.shifts_label}
                  onChange={(e) => setFormData({ ...formData, shifts_label: e.target.value })}
                  placeholder="Ex: Plantões, Turnos, Períodos"
                />
              </div>

              {/* Escala (Singular) */}
              <div className="space-y-2">
                <Label htmlFor="schedule_label">Escala (Singular)</Label>
                <Input
                  id="schedule_label"
                  value={formData.schedule_label}
                  onChange={(e) => setFormData({ ...formData, schedule_label: e.target.value })}
                  placeholder="Ex: Escala, Agenda, Cronograma"
                />
              </div>

              {/* Escalas (Plural) */}
              <div className="space-y-2">
                <Label htmlFor="schedules_label">Escalas (Plural)</Label>
                <Input
                  id="schedules_label"
                  value={formData.schedules_label}
                  onChange={(e) => setFormData({ ...formData, schedules_label: e.target.value })}
                  placeholder="Ex: Escalas, Agendas, Cronogramas"
                />
              </div>

              {/* Troca (Singular) */}
              <div className="space-y-2">
                <Label htmlFor="swap_label">Troca (Singular)</Label>
                <Input
                  id="swap_label"
                  value={formData.swap_label}
                  onChange={(e) => setFormData({ ...formData, swap_label: e.target.value })}
                  placeholder="Ex: Troca, Permuta, Substituição"
                />
              </div>

              {/* Trocas (Plural) */}
              <div className="space-y-2">
                <Label htmlFor="swaps_label">Trocas (Plural)</Label>
                <Input
                  id="swaps_label"
                  value={formData.swaps_label}
                  onChange={(e) => setFormData({ ...formData, swaps_label: e.target.value })}
                  placeholder="Ex: Trocas, Permutas, Substituições"
                />
              </div>

              {/* Extra (Singular) */}
              <div className="space-y-2">
                <Label htmlFor="extra_label">Extra (Singular)</Label>
                <Input
                  id="extra_label"
                  value={formData.extra_label}
                  onChange={(e) => setFormData({ ...formData, extra_label: e.target.value })}
                  placeholder="Ex: Extra, Hora Extra, Adicional"
                />
              </div>

              {/* Extras (Plural) */}
              <div className="space-y-2">
                <Label htmlFor="extras_label">Extras (Plural)</Label>
                <Input
                  id="extras_label"
                  value={formData.extras_label}
                  onChange={(e) => setFormData({ ...formData, extras_label: e.target.value })}
                  placeholder="Ex: Extras, Horas Extras, Adicionais"
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
