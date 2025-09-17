import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Plus,
  User,
  ArrowRightLeft,
  Eye
} from 'lucide-react';

// Mock data - será substituído por dados reais do Supabase
const mockGuard = {
  id: '1',
  name: 'Carlos Silva',
  team: 'A' as const,
  shifts: [
    {
      id: '1',
      date: '2024-01-15',
      period: 'DIURNO' as const,
      location: 'Câmara Municipal',
      hours: '08:00 - 18:00'
    },
    {
      id: '2',
      date: '2024-01-17',
      period: 'NOTURNO' as const,
      location: 'Museu do Legislativo',
      hours: '18:00 - 08:00'
    },
    {
      id: '3',
      date: '2024-01-20',
      period: 'DIURNO' as const,
      location: 'Câmara Municipal',
      hours: '08:00 - 18:00'
    },
  ]
};

const mockSwapRequests = [
  {
    id: '1',
    target: { name: 'Maria Santos', team: 'B' },
    myShift: { date: '2024-01-15', period: 'DIURNO', location: 'Câmara Municipal' },
    targetShift: { date: '2024-01-16', period: 'NOTURNO', location: 'Museu do Legislativo' },
    status: 'PENDING' as const,
    createdAt: '2024-01-10T10:30:00Z',
  },
  {
    id: '2',
    target: { name: 'Ana Lima', team: 'D' },
    myShift: { date: '2024-01-20', period: 'DIURNO', location: 'Câmara Municipal' },
    targetShift: { date: '2024-01-18', period: 'DIURNO', location: 'Câmara Municipal' },
    status: 'APPROVED' as const,
    createdAt: '2024-01-08T14:20:00Z',
  },
];

const GuardDashboard = () => {
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDateStatus = (dateString: string) => {
    const today = new Date();
    const shiftDate = new Date(dateString);
    const diffDays = Math.ceil((shiftDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Concluído', color: 'text-muted-foreground' };
    if (diffDays === 0) return { label: 'Hoje', color: 'text-primary font-medium' };
    if (diffDays <= 3) return { label: `Em ${diffDays} dias`, color: 'text-warning' };
    return { label: `${diffDays} dias`, color: 'text-foreground' };
  };

  return (
    <AppLayout
      title="Meu Painel"
      user={{ name: mockGuard.name, role: 'GUARD', teamName: mockGuard.team }}
      notificationCount={1}
    >
      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <Button className="gap-2 bg-gradient-to-r from-primary to-primary-hover">
          <Plus className="h-4 w-4" />
          Solicitar Troca de Plantão
        </Button>
        <Button variant="outline" className="gap-2">
          <Eye className="h-4 w-4" />
          Ver Escala Completa
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Shifts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Meus Próximos Plantões
                </CardTitle>
                <CardDescription>
                  Seus turnos programados - Equipe {mockGuard.team}
                </CardDescription>
              </div>
              <div className="flex gap-1">
                <Button
                  variant={viewMode === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                >
                  Semana
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                >
                  Mês
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockGuard.shifts.map((shift) => {
                const dateStatus = getDateStatus(shift.date);
                return (
                  <div
                    key={shift.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatDate(shift.date)}</span>
                        <span className={dateStatus.color}>({dateStatus.label})</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {shift.period} - {shift.hours}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {shift.location}
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ArrowRightLeft className="h-4 w-4" />
                      Trocar
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Swap Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Minhas Solicitações
            </CardTitle>
            <CardDescription>
              Acompanhe o status das suas trocas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockSwapRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{request.target.name}</span>
                      <TeamBadge team={request.target.team as any} />
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="font-medium text-foreground">Meu turno:</span>
                        <br />
                        {formatDate(request.myShift.date)} - {request.myShift.period}
                        <br />
                        {request.myShift.location}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Turno solicitado:</span>
                        <br />
                        {formatDate(request.targetShift.date)} - {request.targetShift.period}
                        <br />
                        {request.targetShift.location}
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <span>Solicitado em {formatDate(request.createdAt)} às {formatTime(request.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {mockSwapRequests.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma solicitação de troca encontrada</p>
                  <p className="text-sm">Clique em "Solicitar Troca" para começar</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default GuardDashboard;