import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar,
  BarChart3,
  ArrowUpRight,
  Filter
} from 'lucide-react';

// Mock data - será substituído por dados reais do Supabase
const mockStats = {
  pendingSwaps: 8,
  approvedSwaps: 24,
  rejectedSwaps: 3,
  totalGuards: 20,
  activeTeams: 4,
};

const mockSwapRequests = [
  {
    id: '1',
    requester: { name: 'Carlos Silva', team: 'A' },
    target: { name: 'Maria Santos', team: 'B' },
    requesterShift: { date: '2024-01-15', period: 'DIURNO', location: 'Câmara Municipal' },
    targetShift: { date: '2024-01-16', period: 'NOTURNO', location: 'Museu do Legislativo' },
    status: 'PENDING' as const,
    createdAt: '2024-01-10T10:30:00Z',
  },
  {
    id: '2',
    requester: { name: 'João Costa', team: 'C' },
    target: { name: 'Ana Lima', team: 'D' },
    requesterShift: { date: '2024-01-20', period: 'NOTURNO', location: 'Câmara Municipal' },
    targetShift: { date: '2024-01-18', period: 'DIURNO', location: 'Câmara Municipal' },
    status: 'PENDING' as const,
    createdAt: '2024-01-09T15:45:00Z',
  },
];

const AdminDashboard = () => {
  const [filter, setFilter] = useState('all');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AppLayout
      title="Dashboard Administrativo"
      user={{ name: 'Admin Sistema', role: 'ADMIN' }}
      notificationCount={3}
    >
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trocas Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{mockStats.pendingSwaps}</div>
            <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas (Mês)</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{mockStats.approvedSwaps}</div>
            <p className="text-xs text-muted-foreground">
              +12% em relação ao mês anterior
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas (Mês)</CardTitle>
            <XCircle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{mockStats.rejectedSwaps}</div>
            <p className="text-xs text-muted-foreground">Taxa de rejeição: 11%</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Seguranças</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.totalGuards}</div>
            <p className="text-xs text-muted-foreground">Distribuídos em 4 equipes</p>
          </CardContent>
        </Card>
      </div>

      {/* Swap Requests */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Solicitações de Troca
              </CardTitle>
              <CardDescription>
                Gerencie as solicitações de troca de plantão
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to="/admin/equipes">
                <Users className="h-4 w-4" />
                Gerenciar Equipes
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link to="/admin/trocas">
                <Filter className="h-4 w-4" />
                Gerenciar Trocas
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockSwapRequests.map((request) => (
              <div
                key={request.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{request.requester.name}</span>
                    <TeamBadge team={request.requester.team as any} />
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{request.target.name}</span>
                    <TeamBadge team={request.target.team as any} />
                  </div>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>
                      <strong>{request.requester.name}:</strong> {formatDate(request.requesterShift.date)} - 
                      {request.requesterShift.period} na {request.requesterShift.location}
                    </div>
                    <div>
                      <strong>{request.target.name}:</strong> {formatDate(request.targetShift.date)} - 
                      {request.targetShift.period} na {request.targetShift.location}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Solicitado em {formatDate(request.createdAt)} às {formatTime(request.createdAt)}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 mt-3 sm:mt-0">
                  <StatusBadge status={request.status} />
                  {request.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-success hover:bg-success hover:text-success-foreground">
                        Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="text-danger hover:bg-danger hover:text-danger-foreground">
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
};

export default AdminDashboard;