import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText,
  Search,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  MessageSquare,
  Users,
  Eye
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GuardWithNotes {
  id: string;
  name: string;
  team_id: string | null;
  is_active: boolean;
  team?: {
    id: string;
    name: string;
    color: string;
  };
  notes_count: number;
  positive_count: number;
  negative_count: number;
  incident_count: number;
  neutral_count: number;
  last_note_date: string | null;
}

interface Team {
  id: string;
  name: string;
  color: string;
}

const AdminFichas = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [guards, setGuards] = useState<GuardWithNotes[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      await Promise.all([fetchGuardsWithNotes(), fetchTeams()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, color')
      .eq('admin_id', profile?.id)
      .order('name');

    if (!error && data) {
      setTeams(data);
    }
  };

  const fetchGuardsWithNotes = async () => {
    // Fetch guards
    const { data: guardsData, error: guardsError } = await supabase
      .from('profiles')
      .select('id, name, team_id, is_active, team:teams(id, name, color)')
      .eq('admin_id', profile?.id)
      .order('name');

    if (guardsError) {
      console.error('Error fetching guards:', guardsError);
      return;
    }

    // Fetch all notes for the organization's guards
    const guardIds = guardsData?.map((g: { id: string }) => g.id) || [];
    
    if (guardIds.length === 0) {
      setGuards([]);
      return;
    }

    const { data: notesData, error: notesError } = await supabase
      .from('guard_notes')
      .select('guard_id, note_type, note_date')
      .in('guard_id', guardIds);

    if (notesError) {
      console.error('Error fetching notes:', notesError);
    }

    // Process guards with notes counts
    const guardsWithNotes: GuardWithNotes[] = (guardsData || []).map((guard: { id: string; name: string; team_id: string | null; is_active: boolean; team: Team | null }) => {
      const guardNotes = (notesData || []).filter((n: { guard_id: string }) => n.guard_id === guard.id);
      const lastNote = guardNotes.sort((a: { note_date: string }, b: { note_date: string }) => 
        new Date(b.note_date).getTime() - new Date(a.note_date).getTime()
      )[0];

      return {
        id: guard.id,
        name: guard.name,
        team_id: guard.team_id,
        is_active: guard.is_active,
        team: guard.team as Team | undefined,
        notes_count: guardNotes.length,
        positive_count: guardNotes.filter((n: { note_type: string }) => n.note_type === 'positive').length,
        negative_count: guardNotes.filter((n: { note_type: string }) => n.note_type === 'negative').length,
        incident_count: guardNotes.filter((n: { note_type: string }) => n.note_type === 'incident').length,
        neutral_count: guardNotes.filter((n: { note_type: string }) => n.note_type === 'neutral').length,
        last_note_date: lastNote?.note_date || null,
      };
    });

    setGuards(guardsWithNotes);
  };

  const filteredGuards = guards.filter(guard => {
    const matchesSearch = guard.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTeam = teamFilter === 'all' || guard.team_id === teamFilter;
    
    let matchesType = true;
    if (typeFilter === 'with_positive') {
      matchesType = guard.positive_count > 0;
    } else if (typeFilter === 'with_negative') {
      matchesType = guard.negative_count > 0;
    } else if (typeFilter === 'with_incident') {
      matchesType = guard.incident_count > 0;
    } else if (typeFilter === 'no_notes') {
      matchesType = guard.notes_count === 0;
    }

    return matchesSearch && matchesTeam && matchesType;
  });

  const totalStats = {
    total: guards.length,
    positive: guards.reduce((acc, g) => acc + g.positive_count, 0),
    negative: guards.reduce((acc, g) => acc + g.negative_count, 0),
    incident: guards.reduce((acc, g) => acc + g.incident_count, 0),
    neutral: guards.reduce((acc, g) => acc + g.neutral_count, 0),
  };

  return (
    <AppLayout
      title="Fichas dos Seguranças"
      user={profile ? { name: profile.name, role: 'ADMIN' } : undefined}
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Seguranças</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalStats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positivas</CardTitle>
              <ThumbsUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalStats.positive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negativas</CardTitle>
              <ThumbsDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalStats.negative}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ocorrências</CardTitle>
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{totalStats.incident}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Neutras</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{totalStats.neutral}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Lista de Fichas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filtrar por equipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipes</SelectItem>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="with_positive">Com positivas</SelectItem>
                  <SelectItem value="with_negative">Com negativas</SelectItem>
                  <SelectItem value="with_incident">Com ocorrências</SelectItem>
                  <SelectItem value="no_notes">Sem observações</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredGuards.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum segurança encontrado.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Equipe</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <ThumbsUp className="h-4 w-4 text-green-600" />
                        </span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <ThumbsDown className="h-4 w-4 text-red-600" />
                        </span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                        </span>
                      </TableHead>
                      <TableHead>Última Obs.</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGuards.map((guard) => (
                      <TableRow key={guard.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {guard.name}
                            {!guard.is_active && (
                              <Badge variant="secondary" className="text-xs">Inativo</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {guard.team ? (
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: guard.team.color,
                                color: guard.team.color,
                              }}
                            >
                              {guard.team.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {guard.notes_count}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600 font-medium">
                            {guard.positive_count}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-red-600 font-medium">
                            {guard.negative_count}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-amber-600 font-medium">
                            {guard.incident_count}
                          </span>
                        </TableCell>
                        <TableCell>
                          {guard.last_note_date ? (
                            format(parseISO(guard.last_note_date), 'dd/MM/yyyy', { locale: ptBR })
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <Link to={`/admin/ficha/${guard.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Ficha
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminFichas;
