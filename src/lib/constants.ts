import { TeamName, ShiftPeriod, LocationName } from './types';

export const TEAMS: { name: TeamName; color: string }[] = [
  { name: 'A', color: 'bg-blue-100 text-blue-800' },
  { name: 'B', color: 'bg-green-100 text-green-800' },
  { name: 'C', color: 'bg-yellow-100 text-yellow-800' },
  { name: 'D', color: 'bg-purple-100 text-purple-800' },
];

export const SHIFT_PERIODS: { period: ShiftPeriod; label: string; hours: string }[] = [
  { period: 'DIURNO', label: 'Diurno', hours: '08:00 - 18:00' },
  { period: 'NOTURNO', label: 'Noturno', hours: '18:00 - 08:00' },
  { period: 'OUTRO', label: 'Outro', hours: 'Horário especial' },
];

export const LOCATIONS: { name: LocationName; displayName: string; capacity: number }[] = [
  { name: 'CÂMARA_MUNICIPAL', displayName: 'Câmara Municipal', capacity: 4 },
  { name: 'MUSEU_LEGISLATIVO', displayName: 'Museu do Legislativo', capacity: 1 },
];

export const SWAP_STATUS_CONFIG = {
  PENDING: {
    label: 'Pendente',
    color: 'bg-warning-light text-warning border-warning/20',
    icon: 'Clock'
  },
  APPROVED: {
    label: 'Aprovada',
    color: 'bg-success-light text-success border-success/20',
    icon: 'CheckCircle'
  },
  REJECTED: {
    label: 'Rejeitada',
    color: 'bg-danger-light text-danger border-danger/20',
    icon: 'XCircle'
  },
  CANCELLED: {
    label: 'Cancelada',
    color: 'bg-muted text-muted-foreground border-border',
    icon: 'Ban'
  }
};