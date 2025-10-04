export type SwapStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'APPROVED' | 'CANCELLED';

// Database types matching Supabase schema
export interface Team {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone?: string | null;
  team_id?: string | null;
  team?: Team;
  is_shift_chief?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SwapRequest {
  id: string;
  requester_id: string;
  target_id: string;
  requester_shift_date: string; // Data do plantão do solicitante que será trocado
  target_shift_date: string; // Data do plantão que o solicitante quer assumir
  reason: string;
  status: SwapStatus;
  target_confirmation: boolean;
  admin_approved: boolean;
  admin_approved_by?: string;
  admin_approved_at?: string;
  requester?: Profile;
  target?: Profile;
  admin_approver?: Profile;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, any>;
  user?: Profile;
  created_at: string;
}

export interface DashboardStats {
  pendingSwaps: number;
  approvedSwaps: number;
  rejectedSwaps: number;
  totalGuards: number;
  activeTeams: number;
}