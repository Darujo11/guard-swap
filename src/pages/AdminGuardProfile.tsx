import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInYears, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ArrowLeft,
  User,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Shield,
  Crown,
  Edit,
  Save,
  X,
  FileText,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  CalendarOff,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  FileWarning,
  Camera,
  Loader2
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface GuardProfile {
  id: string;
  name: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  team_id: string | null;
  is_shift_chief: boolean;
  is_active: boolean;
  birth_date: string | null;
  cpf: string | null;
  rg: string | null;
  address: string | null;
  emergency_contact: string | null;
  emergency_phone: string | null;
  hire_date: string | null;
  photo_url: string | null;
  team?: {
    id: string;
    name: string;
    color: string;
  };
}

interface GuardNote {
  id: string;
  guard_id: string;
  admin_id: string;
  note_date: string;
  note_type: 'positive' | 'negative' | 'neutral' | 'incident';
  title: string;
  description: string;
  created_at: string;
}

interface SwapRequest {
  id: string;
  requester_id: string;
  target_id: string;
  requester_shift_date: string;
  target_shift_date: string;
  reason: string;
  status: string;
  created_at: string;
  requester?: { name: string };
  target?: { name: string };
}

interface Extra {
  id: string;
  guard_id: string;
  extra_date: string;
  month_reference: string;
  quantity: number;
  percentage_type: number;
  justification: string;
}

interface Leave {
  id: string;
  guard_id: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  custom_type: string | null;
  notes: string | null;
}

const noteTypeConfig = {
  positive: { label: 'Positivo', icon: ThumbsUp, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
  negative: { label: 'Negativo', icon: ThumbsDown, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
  neutral: { label: 'Neutro', icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  incident: { label: 'Ocorrência', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' },
};

const AdminGuardProfile = () => {
  const { guardId } = useParams<{ guardId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [guard, setGuard] = useState<GuardProfile | null>(null);
  const [notes, setNotes] = useState<GuardNote[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<GuardProfile>>({});
  
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<GuardNote | null>(null);
  const [noteForm, setNoteForm] = useState({
    note_date: format(new Date(), 'yyyy-MM-dd'),
    note_type: 'neutral' as 'positive' | 'negative' | 'neutral' | 'incident',
    title: '',
    description: '',
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !guard) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Erro',
        description: 'Apenas imagens são permitidas.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Erro',
        description: 'A imagem deve ter no máximo 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${guard.id}-${Date.now()}.${fileExt}`;

      if (guard.photo_url) {
        const oldPath = guard.photo_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('guard-photos').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('guard-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('guard-photos')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', guard.id);

      if (updateError) throw updateError;

      toast({
        title: 'Foto atualizada',
        description: 'A foto foi salva com sucesso.',
      });
      fetchGuardProfile();
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar foto',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!guard?.photo_url) return;
    if (!confirm('Tem certeza que deseja remover a foto?')) return;

    try {
      const fileName = guard.photo_url.split('/').pop();
      if (fileName) {
        await supabase.storage.from('guard-photos').remove([fileName]);
      }

      await supabase.from('profiles').update({ photo_url: null }).eq('id', guard.id);
      
      toast({ title: 'Foto removida' });
      fetchGuardProfile();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (guardId && profile?.id) {
      fetchAllData();
    }
  }, [guardId, profile?.id]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchGuardProfile(),
        fetchNotes(),
        fetchSwaps(),
        fetchExtras(),
        fetchLeaves(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGuardProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, team:teams(*)')
      .eq('id', guardId)
      .single();

    if (error) {
      console.error('Error fetching guard profile:', error);
      toast({
        title: 'Erro ao carregar perfil',
        description: 'Não foi possível carregar os dados do segurança.',
        variant: 'destructive',
      });
      return;
    }

    setGuard(data as GuardProfile);
    setEditForm(data);
  };

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('guard_notes')
      .select('*')
      .eq('guard_id', guardId)
      .order('note_date', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
      return;
    }

    setNotes(data as GuardNote[]);
  };

  const fetchSwaps = async () => {
    const { data, error } = await supabase
      .from('swap_requests')
      .select('*, requester:profiles!swap_requests_requester_id_fkey(name), target:profiles!swap_requests_target_id_fkey(name)')
      .or(`requester_id.eq.${guardId},target_id.eq.${guardId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching swaps:', error);
      return;
    }

    setSwaps(data as SwapRequest[]);
  };

  const fetchExtras = async () => {
    const { data, error } = await supabase
      .from('extras')
      .select('*')
      .eq('guard_id', guardId)
      .order('extra_date', { ascending: false });

    if (error) {
      console.error('Error fetching extras:', error);
      return;
    }

    setExtras(data as Extra[]);
  };

  const fetchLeaves = async () => {
    const { data, error } = await supabase
      .from('leaves')
      .select('*')
      .eq('guard_id', guardId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching leaves:', error);
      return;
    }

    setLeaves(data as Leave[]);
  };

  const handleSaveProfile = async () => {
    if (!guard) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          birth_date: editForm.birth_date,
          cpf: editForm.cpf,
          rg: editForm.rg,
          address: editForm.address,
          emergency_contact: editForm.emergency_contact,
          emergency_phone: editForm.emergency_phone,
          hire_date: editForm.hire_date,
        })
        .eq('id', guard.id);

      if (error) throw error;

      toast({
        title: 'Dados salvos',
        description: 'As informações foram atualizadas com sucesso.',
      });

      setIsEditing(false);
      fetchGuardProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveNote = async () => {
    if (!noteForm.title.trim() || !noteForm.description.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Título e descrição são obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (editingNote) {
        const { error } = await supabase
          .from('guard_notes')
          .update({
            note_date: noteForm.note_date,
            note_type: noteForm.note_type,
            title: noteForm.title,
            description: noteForm.description,
          })
          .eq('id', editingNote.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('guard_notes')
          .insert({
            guard_id: guardId,
            admin_id: profile?.id,
            note_date: noteForm.note_date,
            note_type: noteForm.note_type,
            title: noteForm.title,
            description: noteForm.description,
          });

        if (error) throw error;
      }

      toast({
        title: editingNote ? 'Observação atualizada' : 'Observação adicionada',
        description: 'A observação foi salva com sucesso.',
      });

      setIsNoteDialogOpen(false);
      resetNoteForm();
      fetchNotes();
    } catch (error: any) {
      console.error('Error saving note:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message || 'Não foi possível salvar a observação.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta observação?')) return;

    try {
      const { error } = await supabase
        .from('guard_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast({
        title: 'Observação excluída',
        description: 'A observação foi removida com sucesso.',
      });

      fetchNotes();
    } catch (error: any) {
      console.error('Error deleting note:', error);
      toast({
        title: 'Erro ao excluir',
        description: error.message || 'Não foi possível excluir a observação.',
        variant: 'destructive',
      });
    }
  };

  const openEditNote = (note: GuardNote) => {
    setEditingNote(note);
    setNoteForm({
      note_date: note.note_date,
      note_type: note.note_type,
      title: note.title,
      description: note.description,
    });
    setIsNoteDialogOpen(true);
  };

  const resetNoteForm = () => {
    setEditingNote(null);
    setNoteForm({
      note_date: format(new Date(), 'yyyy-MM-dd'),
      note_type: 'neutral',
      title: '',
      description: '',
    });
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), parseISO(birthDate));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      PENDING: { label: 'Pendente', variant: 'secondary' },
      ACCEPTED: { label: 'Aceita', variant: 'default' },
      APPROVED: { label: 'Aprovada', variant: 'default' },
      REJECTED: { label: 'Rejeitada', variant: 'destructive' },
      CANCELLED: { label: 'Cancelada', variant: 'outline' },
    };
    const config = statusConfig[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const generatePDF = () => {
    if (!guard) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.text('Ficha do Segurança', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 28, { align: 'center' });

    let yPos = 40;

    // Personal Data
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Dados Pessoais', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const personalData = [
      ['Nome:', guard.full_name || guard.name],
      ['Email:', guard.email],
      ['Telefone:', guard.phone || '-'],
      ['CPF:', guard.cpf || '-'],
      ['RG:', guard.rg || '-'],
      ['Data de Nascimento:', guard.birth_date ? `${format(parseISO(guard.birth_date), 'dd/MM/yyyy')} (${calculateAge(guard.birth_date)} anos)` : '-'],
      ['Endereço:', guard.address || '-'],
      ['Contato de Emergência:', guard.emergency_contact || '-'],
      ['Telefone de Emergência:', guard.emergency_phone || '-'],
      ['Data de Admissão:', guard.hire_date ? format(parseISO(guard.hire_date), 'dd/MM/yyyy') : '-'],
      ['Equipe:', guard.team?.name || '-'],
      ['Cargo:', guard.is_shift_chief ? 'Chefe de Plantão' : 'Segurança'],
      ['Status:', guard.is_active ? 'Ativo' : 'Inativo'],
    ];

    personalData.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 14, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value), 60, yPos);
      yPos += 6;
    });

    yPos += 10;

    // Summary
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo de Atividades', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Trocas: ${swaps.length}`, 14, yPos);
    yPos += 6;
    doc.text(`Total de Extras: ${extras.length}`, 14, yPos);
    yPos += 6;
    doc.text(`Total de Folgas/Atestados: ${leaves.length}`, 14, yPos);
    yPos += 6;
    doc.text(`Observações Positivas: ${notes.filter(n => n.note_type === 'positive').length}`, 14, yPos);
    yPos += 6;
    doc.text(`Observações Negativas: ${notes.filter(n => n.note_type === 'negative').length}`, 14, yPos);
    yPos += 6;
    doc.text(`Ocorrências: ${notes.filter(n => n.note_type === 'incident').length}`, 14, yPos);

    // Notes Table
    if (notes.length > 0) {
      yPos += 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Observações e Ocorrências', 14, yPos);
      
      autoTable(doc, {
        startY: yPos + 5,
        head: [['Data', 'Tipo', 'Título', 'Descrição']],
        body: notes.map(note => [
          format(parseISO(note.note_date), 'dd/MM/yyyy'),
          noteTypeConfig[note.note_type].label,
          note.title,
          note.description.length > 50 ? note.description.substring(0, 50) + '...' : note.description,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    doc.save(`ficha-${guard.name.replace(/\s+/g, '-').toLowerCase()}.pdf`);

    toast({
      title: 'PDF gerado',
      description: 'O relatório foi baixado com sucesso.',
    });
  };

  if (loading) {
    return (
      <AppLayout title="Ficha do Segurança" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando...</div>
        </div>
      </AppLayout>
    );
  }

  if (!guard) {
    return (
      <AppLayout title="Ficha do Segurança" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
        <div className="text-center py-12">
          <FileWarning className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Segurança não encontrado.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/admin/segurancas">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Ficha do Segurança" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" asChild>
            <Link to="/admin/segurancas">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
          <Button onClick={generatePDF} className="gap-2">
            <FileText className="h-4 w-4" />
            Gerar PDF
          </Button>
        </div>

        {/* Personal Data Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados Pessoais
              </CardTitle>
              <CardDescription>Informações do segurança</CardDescription>
            </div>
            {isEditing ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveProfile}>
                  <Save className="h-4 w-4 mr-1" />
                  Salvar
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    {guard.photo_url ? (
                      <img 
                        src={guard.photo_url} 
                        alt={guard.name}
                        className="h-16 w-16 rounded-full object-cover border-2 border-primary/20"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">
                          {guard.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    
                    {/* Overlay with buttons */}
                    <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors disabled:opacity-50"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        title="Alterar foto"
                      >
                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                      </button>
                      {guard.photo_url && (
                        <button
                          type="button"
                          className="h-7 w-7 rounded-full bg-white/20 hover:bg-red-500/70 flex items-center justify-center text-white transition-colors"
                          onClick={handleRemovePhoto}
                          title="Remover foto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{guard.name}</h3>
                    <div className="flex items-center gap-2">
                      {guard.team && (
                        <Badge 
                          style={{ backgroundColor: guard.team.color + '20', color: guard.team.color, borderColor: guard.team.color }}
                          variant="outline"
                        >
                          {guard.team.name}
                        </Badge>
                      )}
                      {guard.is_shift_chief && (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
                          <Crown className="h-3 w-3 mr-1" />
                          Chefe
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {guard.email}
                  </div>
                  {guard.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {guard.phone}
                    </div>
                  )}
                </div>
              </div>

              {/* Extended Info - Editable */}
              <div className="space-y-3 md:col-span-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.full_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                        placeholder="Nome completo"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{guard.full_name || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Data de Nascimento</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editForm.birth_date || ''}
                        onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {guard.birth_date 
                          ? `${format(parseISO(guard.birth_date), 'dd/MM/yyyy')} (${calculateAge(guard.birth_date)} anos)`
                          : '-'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>CPF</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.cpf || ''}
                        onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{guard.cpf || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>RG</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.rg || ''}
                        onChange={(e) => setEditForm({ ...editForm, rg: e.target.value })}
                        placeholder="00.000.000-0"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{guard.rg || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Data de Admissão</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editForm.hire_date || ''}
                        onChange={(e) => setEditForm({ ...editForm, hire_date: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {guard.hire_date ? format(parseISO(guard.hire_date), 'dd/MM/yyyy') : '-'}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Contato de Emergência</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.emergency_contact || ''}
                        onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })}
                        placeholder="Nome do contato"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{guard.emergency_contact || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Telefone de Emergência</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.emergency_phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, emergency_phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{guard.emergency_phone || '-'}</p>
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label>Endereço</Label>
                    {isEditing ? (
                      <Input
                        value={editForm.address || ''}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        placeholder="Endereço completo"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{guard.address || '-'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{swaps.length}</p>
                  <p className="text-sm text-muted-foreground">Trocas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{extras.length}</p>
                  <p className="text-sm text-muted-foreground">Extras</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <CalendarOff className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{leaves.length}</p>
                  <p className="text-sm text-muted-foreground">Folgas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <ThumbsUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{notes.filter(n => n.note_type === 'positive').length}</p>
                  <p className="text-sm text-muted-foreground">Positivos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <ThumbsDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{notes.filter(n => n.note_type === 'negative').length}</p>
                  <p className="text-sm text-muted-foreground">Negativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="swaps" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="swaps">Trocas</TabsTrigger>
            <TabsTrigger value="extras">Extras</TabsTrigger>
            <TabsTrigger value="leaves">Folgas</TabsTrigger>
            <TabsTrigger value="notes">Observações</TabsTrigger>
          </TabsList>

          <TabsContent value="swaps">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Histórico de Trocas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {swaps.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma troca registrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Participantes</TableHead>
                        <TableHead>Datas da Troca</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {swaps.map((swap) => (
                        <TableRow key={swap.id}>
                          <TableCell>{format(parseISO(swap.created_at), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            {swap.requester_id === guardId ? (
                              <span>Com: {swap.target?.name}</span>
                            ) : (
                              <span>De: {swap.requester?.name}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(swap.requester_shift_date), 'dd/MM')} ↔ {format(parseISO(swap.target_shift_date), 'dd/MM')}
                          </TableCell>
                          <TableCell>{getStatusBadge(swap.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="extras">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Histórico de Extras
                </CardTitle>
              </CardHeader>
              <CardContent>
                {extras.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum extra registrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Mês Ref.</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Justificativa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extras.map((extra) => (
                        <TableRow key={extra.id}>
                          <TableCell>{format(parseISO(extra.extra_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>{format(parseISO(extra.month_reference), 'MM/yyyy')}</TableCell>
                          <TableCell>{extra.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{extra.percentage_type}%</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{extra.justification}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leaves">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarOff className="h-5 w-5" />
                  Histórico de Folgas e Atestados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaves.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma folga ou atestado registrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Período</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Observações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.map((leave) => (
                        <TableRow key={leave.id}>
                          <TableCell>
                            {format(parseISO(leave.start_date), 'dd/MM/yyyy')} - {format(parseISO(leave.end_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{leave.custom_type || leave.leave_type}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{leave.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Observações e Ocorrências
                </CardTitle>
                <Button onClick={() => { resetNoteForm(); setIsNoteDialogOpen(true); }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Observação
                </Button>
              </CardHeader>
              <CardContent>
                {notes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma observação registrada.</p>
                ) : (
                  <div className="space-y-4">
                    {notes.map((note) => {
                      const config = noteTypeConfig[note.note_type];
                      const Icon = config.icon;
                      return (
                        <div key={note.id} className={`p-4 rounded-lg border ${config.bg}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{note.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {config.label}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{note.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(parseISO(note.note_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openEditNote(note)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Note Dialog */}
        <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingNote ? 'Editar Observação' : 'Nova Observação'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={noteForm.note_date}
                    onChange={(e) => setNoteForm({ ...noteForm, note_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={noteForm.note_type}
                    onValueChange={(value: 'positive' | 'negative' | 'neutral' | 'incident') => 
                      setNoteForm({ ...noteForm, note_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positive">🟢 Positivo</SelectItem>
                      <SelectItem value="negative">🔴 Negativo</SelectItem>
                      <SelectItem value="neutral">🔵 Neutro</SelectItem>
                      <SelectItem value="incident">🟡 Ocorrência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  placeholder="Ex: Excelente desempenho, Atraso no plantão..."
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={noteForm.description}
                  onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })}
                  placeholder="Descreva a situação em detalhes..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveNote}>
                {editingNote ? 'Salvar' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminGuardProfile;
