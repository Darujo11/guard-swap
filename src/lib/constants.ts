export const TEAM_COLORS = [
  { name: 'Equipe A', color: 'bg-blue-100 text-blue-800' },
  { name: 'Equipe B', color: 'bg-green-100 text-green-800' },
  { name: 'Equipe C', color: 'bg-yellow-100 text-yellow-800' },
  { name: 'Equipe D', color: 'bg-purple-100 text-purple-800' },
];

export const SWAP_STATUS_CONFIG = {
  PENDING: {
    label: 'Pendente',
    color: 'bg-warning-light text-warning border-warning/20',
    icon: 'Clock'
  },
  ACCEPTED: {
    label: 'Aceita',
    color: 'bg-info-light text-info border-info/20',
    icon: 'CheckCircle2'
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