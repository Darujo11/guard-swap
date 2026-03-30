import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface OrganizationSettings {
  id?: string;
  admin_id?: string;
  guard_label: string;
  guards_label: string;
  team_label: string;
  teams_label: string;
  shift_label: string;
  shifts_label: string;
  schedule_label: string;
  schedules_label: string;
  swap_label: string;
  swaps_label: string;
  extra_label: string;
  extras_label: string;
  swap_same_month_only: boolean;
  swaps_blocked: boolean;
}

const defaultSettings: OrganizationSettings = {
  guard_label: 'Segurança',
  guards_label: 'Seguranças',
  team_label: 'Equipe',
  teams_label: 'Equipes',
  shift_label: 'Plantão',
  shifts_label: 'Plantões',
  schedule_label: 'Escala',
  schedules_label: 'Escalas',
  swap_label: 'Troca',
  swaps_label: 'Trocas',
  extra_label: 'Extra',
  extras_label: 'Extras',
  swap_same_month_only: false,
  swaps_blocked: false,
};

export function useOrganizationSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings = defaultSettings, isLoading } = useQuery({
    queryKey: ['organization-settings'],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('admin_id')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (!profile?.admin_id) return defaultSettings;

      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .eq('admin_id', profile.admin_id)
        .maybeSingle();

      if (error || !data) return defaultSettings;
      return data as OrganizationSettings;
    },
    enabled: !!user,
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<OrganizationSettings>) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, admin_id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const adminId = profile.admin_id || profile.id;

      const { data: existing } = await supabase
        .from('organization_settings')
        .select('id')
        .eq('admin_id', adminId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('organization_settings')
          .update(newSettings)
          .eq('admin_id', adminId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('organization_settings')
          .insert({ ...newSettings, admin_id: adminId });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-settings'] });
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
}
