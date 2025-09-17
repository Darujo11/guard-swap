export type UserRole = 'ADMIN' | 'GUARD';

export type TeamName = 'A' | 'B' | 'C' | 'D';

export type ShiftPeriod = 'DIURNO' | 'NOTURNO' | 'OUTRO';

export type SwapStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type LocationName = 'CÂMARA_MUNICIPAL' | 'MUSEU_LEGISLATIVO';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId?: string;
  team?: Team;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: TeamName;
  users: User[];
  shifts: Shift[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  name: LocationName;
  displayName: string;
  shifts: Shift[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Shift {
  id: string;
  date: Date;
  period: ShiftPeriod;
  teamId: string;
  team: Team;
  locationId: string;
  location: Location;
  guardId?: string;
  guard?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface SwapRequest {
  id: string;
  requesterId: string;
  requester: User;
  targetId: string;
  target: User;
  requesterShiftId: string;
  requesterShift: Shift;
  targetShiftId: string;
  targetShift: Shift;
  status: SwapStatus;
  reason?: string;
  decidedAt?: Date;
  decidedBy?: string;
  decider?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  user: User;
  type: string;
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  pendingSwaps: number;
  approvedSwaps: number;
  rejectedSwaps: number;
  totalGuards: number;
  activeTeams: number;
}