import { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { TeamBadge } from '@/components/ui/team-badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { SwapRequest, Profile, Team } from '@/lib/types';
import { SWAP_STATUS_CONFIG } from '@/lib/constants';
import { swapTeamSchedules } from '@/utils/swapScheduleUpdate';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoImage from '@/assets/logo-camara.png';

import { 
  Calendar,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  FileDown,
  Clock,
  Users,
  AlertCircle,
  AlertTriangle,
  Trash2,
  ArrowLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  CalendarDays,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

type SortBy = 'created_at' | 'requester_name' | 'target_name' | 'requester_shift_date';
type SortOrder = 'asc' | 'desc';

const AdminSwaps = () => {
  const { profile } = useAuth();
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  
  const [selectedRequest, setSelectedRequest] = useState<SwapRequest | null>(null);
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'approve' | 'reject' | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState<SwapRequest | null>(null);
  const { toast } = useToast();

  // Helper para converter string YYYY-MM-DD em data local (evita problemas de timezone)
  const parseDateOnly = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  useEffect(() => {
    fetchSwapRequests();
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setTeams((data || []) as Team[]);
    } catch (error) {
      console.error('[AdminSwaps][FetchTeams]', error);
    }
  };

  const fetchSwapRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('swap_requests')
        .select(`
          *,
          requester:profiles!swap_requests_requester_id_fkey(
            *,
            team:teams(*)
          ),
          target:profiles!swap_requests_target_id_fkey(
            *,
            team:teams(*)
          ),
          admin_approver:profiles!swap_requests_admin_approved_by_fkey(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSwapRequests((data || []) as SwapRequest[]);
    } catch (error) {
      console.error('[AdminSwaps][FetchData]', error);
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível carregar as solicitações de troca.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Calcular meses disponíveis para filtro
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    swapRequests.forEach(request => {
      const m1 = request.requester_shift_date?.substring(0, 7);
      const m2 = request.target_shift_date?.substring(0, 7);
      if (m1) months.add(m1);
      if (m2) months.add(m2);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [swapRequests]);

  // Contagem de filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (statusFilter !== 'all') count++;
    if (monthFilter !== 'all') count++;
    if (teamFilter !== 'all') count++;
    if (dateFrom || dateTo) count++;
    if (sortBy !== 'created_at' || sortOrder !== 'desc') count++;
    return count;
  }, [searchTerm, statusFilter, monthFilter, teamFilter, dateFrom, dateTo, sortBy, sortOrder]);

  // Limpar todos os filtros
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setMonthFilter('all');
    setTeamFilter('all');
    setDateFrom(undefined);
    setDateTo(undefined);
    setSortBy('created_at');
    setSortOrder('desc');
  };

  // Alternar ordem de ordenação
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Filtrar e ordenar solicitações
  const filteredAndSortedRequests = useMemo(() => {
    let result = swapRequests.filter(request => {
      // Filtro de busca por texto
      const matchesSearch = !searchTerm || 
        request.requester?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.target?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.reason.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro por status
      const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
      
      // Filtro por mês de referência (plantão)
      const matchesMonth = monthFilter === 'all' || 
        request.requester_shift_date?.startsWith(monthFilter) ||
        request.target_shift_date?.startsWith(monthFilter);
      
      // Filtro por equipe
      const matchesTeam = teamFilter === 'all' ||
        request.requester?.team_id === teamFilter ||
        request.target?.team_id === teamFilter;
      
      // Filtro por período de criação
      const createdAt = new Date(request.created_at);
      const matchesDateFrom = !dateFrom || createdAt >= dateFrom;
      const matchesDateTo = !dateTo || createdAt <= new Date(dateTo.getTime() + 24 * 60 * 60 * 1000 - 1);
      
      return matchesSearch && matchesStatus && matchesMonth && matchesTeam && matchesDateFrom && matchesDateTo;
    });

    // Ordenação
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'requester_name':
          comparison = (a.requester?.name || '').localeCompare(b.requester?.name || '', 'pt-BR');
          break;
        case 'target_name':
          comparison = (a.target?.name || '').localeCompare(b.target?.name || '', 'pt-BR');
          break;
        case 'requester_shift_date':
          comparison = (a.requester_shift_date || '').localeCompare(b.requester_shift_date || '');
          break;
        case 'created_at':
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [swapRequests, searchTerm, statusFilter, monthFilter, teamFilter, dateFrom, dateTo, sortBy, sortOrder]);

  const handleDecision = async () => {
    if (!selectedRequest || !decisionAction) return;

    try {
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!adminProfile) throw new Error('Perfil do admin não encontrado');

      const updateData = {
        status: decisionAction === 'approve' ? 'APPROVED' : 'REJECTED',
        admin_approved: decisionAction === 'approve',
        admin_approved_by: adminProfile.id,
        admin_approved_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('swap_requests')
        .update(updateData)
        .eq('id', selectedRequest.id);

      if (error) throw error;

      // Atualizar escala de plantões após aprovação
      if (decisionAction === 'approve') {
        try {
          await swapTeamSchedules(
            selectedRequest.requester_id,
            selectedRequest.target_id,
            selectedRequest.requester_shift_date,
            selectedRequest.target_shift_date
          );
        } catch (scheduleError) {
          console.error('[AdminSwaps] Erro ao atualizar escala:', scheduleError);
          toast({
            title: '⚠️ Troca aprovada, mas escala não atualizada',
            description: 'A troca foi aprovada mas houve erro ao atualizar o calendário.',
            variant: 'destructive',
          });
        }
      }

      // Create audit log
      await supabase.from('audit_logs').insert({
        user_id: adminProfile.id,
        action: decisionAction === 'approve' ? 'SWAP_APPROVED' : 'SWAP_REJECTED',
        entity_type: 'swap_request',
        entity_id: selectedRequest.id,
        details: {
          reason: decisionReason,
          requester_id: selectedRequest.requester_id,
          target_id: selectedRequest.target_id
        }
      });

      // Enviar notificação ao webhook quando aprovar
      if (decisionAction === 'approve' && selectedRequest.requester && selectedRequest.target) {
        try {
          // Verificar autenticação
          const { data: { session } } = await supabase.auth.getSession();
          console.log('🔐 [AdminSwaps][Webhook] Auth check:', session ? 'Autenticado' : 'Não autenticado');
          
          if (!session) {
            toast({
              title: '⚠️ Erro de autenticação',
              description: 'Você precisa estar logado para enviar webhook',
              variant: 'destructive'
            });
            return;
          }

          const webhookPayload = {
            evento: 'troca_aprovada_admin',
            aprovacao_chefe_estado: 'aprovado',
            requester_name: selectedRequest.requester.name,
            requester_email: selectedRequest.requester.email,
            requester_phone: selectedRequest.requester.phone,
            target_name: selectedRequest.target.name,
            target_email: selectedRequest.target.email,
            target_phone: selectedRequest.target.phone,
            requester_shift_date: selectedRequest.requester_shift_date,
            target_shift_date: selectedRequest.target_shift_date,
            reason: selectedRequest.reason,
            status: 'APPROVED',
            created_at: selectedRequest.created_at,
            responded_at: new Date().toISOString(),
            admin_approved: true,
            admin_approved_by: profile?.id || null,
            admin_approved_at: new Date().toISOString(),
          };
          
          console.log('📤 [AdminSwaps][Webhook] Enviando payload de aprovação:', webhookPayload);
          
          const { data: webhookData, error: webhookError } = await supabase.functions.invoke('send-swap-webhook', {
            body: webhookPayload
          });
          
          console.log('✅ [AdminSwaps][Webhook] Resposta do webhook:', webhookData);
          
          if (webhookError) throw webhookError;
          
          toast({
            title: '✅ Webhook enviado',
            description: 'Notificação de aprovação enviada com sucesso',
          });
        } catch (webhookError) {
          console.error('❌ [AdminSwaps][Webhook] Erro ao enviar webhook de aprovação:', webhookError);
          toast({
            title: '❌ Erro ao enviar webhook',
            description: webhookError instanceof Error ? webhookError.message : 'Erro desconhecido ao enviar webhook',
            variant: 'destructive'
          });
          // Não bloquear o fluxo se o webhook falhar
        }
      }

      // Enviar notificação ao webhook quando rejeitar
      if (decisionAction === 'reject' && selectedRequest.requester && selectedRequest.target) {
        try {
          // Verificar autenticação
          const { data: { session } } = await supabase.auth.getSession();
          console.log('🔐 [AdminSwaps][Webhook] Auth check:', session ? 'Autenticado' : 'Não autenticado');
          
          if (!session) {
            toast({
              title: '⚠️ Erro de autenticação',
              description: 'Você precisa estar logado para enviar webhook',
              variant: 'destructive'
            });
            return;
          }

          const webhookPayload = {
            evento: 'troca_rejeitada_admin',
            aprovacao_chefe_estado: 'rejeitado',
            requester_name: selectedRequest.requester.name,
            requester_email: selectedRequest.requester.email,
            requester_phone: selectedRequest.requester.phone,
            target_name: selectedRequest.target.name,
            target_email: selectedRequest.target.email,
            target_phone: selectedRequest.target.phone,
            requester_shift_date: selectedRequest.requester_shift_date,
            target_shift_date: selectedRequest.target_shift_date,
            reason: selectedRequest.reason,
            rejection_reason: decisionReason,
            status: 'REJECTED',
            created_at: selectedRequest.created_at,
            responded_at: new Date().toISOString(),
            admin_approved: false,
            admin_approved_by: profile?.id || null,
            admin_approved_at: new Date().toISOString(),
          };
          
          console.log('📤 [AdminSwaps][Webhook] Enviando payload de rejeição:', webhookPayload);
          
          const { data: webhookData, error: webhookError } = await supabase.functions.invoke('send-swap-webhook', {
            body: webhookPayload
          });
          
          console.log('✅ [AdminSwaps][Webhook] Resposta do webhook:', webhookData);
          
          if (webhookError) throw webhookError;
          
          toast({
            title: '✅ Webhook enviado',
            description: 'Notificação de rejeição enviada com sucesso',
          });
        } catch (webhookError) {
          console.error('❌ [AdminSwaps][Webhook] Erro ao enviar webhook de rejeição:', webhookError);
          toast({
            title: '❌ Erro ao enviar webhook',
            description: webhookError instanceof Error ? webhookError.message : 'Erro desconhecido ao enviar webhook',
            variant: 'destructive'
          });
          // Não bloquear o fluxo se o webhook falhar
        }
      }

      toast({
        title: `Solicitação ${decisionAction === 'approve' ? 'aprovada' : 'rejeitada'}`,
        description: `A solicitação de troca foi ${decisionAction === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso.`,
      });

      await fetchSwapRequests();
      setIsDecisionDialogOpen(false);
      setDecisionReason('');
      setSelectedRequest(null);
    } catch (error) {
      console.error('[AdminSwaps][HandleDecision]', error);
      toast({
        title: 'Erro ao processar',
        description: 'Não foi possível processar a decisão.',
        variant: 'destructive',
      });
    }
  };

  const openDecisionDialog = (request: SwapRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setDecisionAction(action);
    setIsDecisionDialogOpen(true);
  };

  const openDeleteDialog = (request: SwapRequest) => {
    setRequestToDelete(request);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!requestToDelete) return;

    try {
      const { error } = await supabase
        .from('swap_requests')
        .delete()
        .eq('id', requestToDelete.id);

      if (error) throw error;

      toast({
        title: 'Solicitação excluída',
        description: 'A solicitação de troca foi removida com sucesso.',
      });

      await fetchSwapRequests();
      setIsDeleteDialogOpen(false);
      setRequestToDelete(null);
    } catch (error) {
      console.error('[AdminSwaps][HandleDelete]', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir a solicitação.',
        variant: 'destructive',
      });
    }
  };

  const generatePDF = async (request: SwapRequest) => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const statusEmoji = {
        'PENDING': '⏳',
        'ACCEPTED': '✅',
        'APPROVED': '✅',
        'REJECTED': '❌',
        'CANCELLED': '🚫'
      }[request.status] || '📋';

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Solicitação de Troca - ${request.id}</title>
            <meta charset="UTF-8">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; 
                margin: 40px;
                color: #1f2937;
                line-height: 1.8;
                font-size: 14px;
              }
              .header { 
                margin-bottom: 30px;
              }
              .header h1 {
                margin: 0 0 5px 0;
                color: #111827;
                font-size: 20px;
                font-weight: 600;
              }
              .protocol {
                color: #6b7280;
                font-size: 13px;
                margin-top: 5px;
              }
              .section { 
                margin-bottom: 25px;
              }
              .section h3 {
                margin: 0 0 10px 0;
                color: #111827;
                font-size: 15px;
                font-weight: 600;
              }
              .info-row {
                margin: 5px 0;
                font-size: 14px;
                line-height: 1.6;
              }
              .label { 
                font-weight: 500;
                color: #374151;
              }
              .value {
                color: #1f2937;
              }
              .dates {
                font-size: 15px;
                font-weight: 500;
                color: #1f2937;
                margin: 8px 0;
              }
              .reason-text {
                color: #4b5563;
                margin: 8px 0;
                line-height: 1.6;
              }
              .reason-footer {
                margin-top: 8px;
                font-size: 12px;
                color: #9ca3af;
              }
              .footer { 
                margin-top: 40px;
                padding-top: 15px;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📄 Solicitação de Troca de Plantão</h1>
              <p class="protocol">Protocolo: ${request.id}</p>
            </div>
            
            <div class="section">
              <h3>📅 Informações da Solicitação</h3>
              <div class="info-row dates">
                Período da Troca: ${format(parseDateOnly(request.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })} → ${format(parseDateOnly(request.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
              </div>
              <div class="info-row">
                <span class="label">Status:</span> ${statusEmoji} ${SWAP_STATUS_CONFIG[request.status as keyof typeof SWAP_STATUS_CONFIG]?.label}
              </div>
              <div class="info-row">
                <span class="label">Data da Solicitação:</span> ${format(new Date(request.created_at), 'dd/MM/yyyy', { locale: ptBR })} às ${format(new Date(request.created_at), 'HH:mm', { locale: ptBR })}
              </div>
            </div>

            <div class="section">
              <h3>👤 Solicitante</h3>
              <div class="info-row">
                <span class="label">Nome:</span> ${request.requester?.name}
              </div>
              <div class="info-row">
                <span class="label">E-mail:</span> ${request.requester?.email}
              </div>
              <div class="info-row">
                <span class="label">Equipe:</span> ${request.requester?.team?.name}
              </div>
            </div>

            <div class="section">
              <h3>👥 Troca Solicitada com</h3>
              <div class="info-row">
                <span class="label">Nome:</span> ${request.target?.name}
              </div>
              <div class="info-row">
                <span class="label">E-mail:</span> ${request.target?.email}
              </div>
              <div class="info-row">
                <span class="label">Equipe:</span> ${request.target?.team?.name}
              </div>
              <div class="info-row">
                <span class="label">Confirmação de Ciência:</span> ${request.target_confirmation ? '✅ Confirmada' : '⏳ Pendente'}
              </div>
            </div>

            <div class="section">
              <h3>📝 Motivo da Troca</h3>
              <div class="reason-text">
                ${request.reason}
              </div>
              <div class="reason-footer">
                (registrado em ${format(new Date(request.created_at), 'dd/MM/yyyy', { locale: ptBR })} às ${format(new Date(request.created_at), 'HH:mm', { locale: ptBR })})
              </div>
            </div>

            ${request.admin_approved_at ? `
              <div class="section">
                <h3>⚖️ Decisão Administrativa</h3>
                <div class="info-row">
                  <span class="label">Decidido em:</span> ${format(new Date(request.admin_approved_at), 'dd/MM/yyyy', { locale: ptBR })} às ${format(new Date(request.admin_approved_at), 'HH:mm', { locale: ptBR })}
                </div>
                <div class="info-row">
                  <span class="label">Aprovado por:</span> ${request.admin_approver?.name || 'Coordenador'}
                </div>
              </div>
            ` : ''}

            <div class="footer">
              📄 Documento gerado em: ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })} às ${format(new Date(), 'HH:mm', { locale: ptBR })}
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('[AdminSwaps][GeneratePDF]', error);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Não foi possível gerar o PDF da solicitação.',
        variant: 'destructive',
      });
    }
  };

  const getStats = () => {
    return {
      pending: swapRequests.filter(r => r.status === 'PENDING').length,
      needConfirmation: swapRequests.filter(r => r.status === 'ACCEPTED' && !r.target_confirmation).length,
      approved: swapRequests.filter(r => r.status === 'APPROVED').length,
      rejected: swapRequests.filter(r => r.status === 'REJECTED').length,
    };
  };

  const stats = getStats();

  // Função para carregar logo como base64 com dimensões
  const loadLogoAsBase64 = (): Promise<{ base64: string; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve({
          base64: canvas.toDataURL('image/png'),
          width: img.width,
          height: img.height
        });
      };
      img.onerror = reject;
      img.src = logoImage;
    });
  };

  // Gerar relatório PDF de trocas
  const generateSwapsReportPDF = async () => {
    try {
      if (filteredAndSortedRequests.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Sem dados',
          description: 'Nenhuma solicitação encontrada com os filtros aplicados.',
        });
        return;
      }

      const doc = new jsPDF();
      
      // Carregar logo com proporção correta
      try {
        const logoData = await loadLogoAsBase64();
        const desiredWidth = 25;
        const aspectRatio = logoData.height / logoData.width;
        const calculatedHeight = desiredWidth * aspectRatio;
        doc.addImage(logoData.base64, 'PNG', 14, 10, desiredWidth, calculatedHeight);
      } catch (logoError) {
        console.warn('[AdminSwaps][GenerateReport] Erro ao carregar logo:', logoError);
      }

      // Título
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Trocas de Plantão', 45, 20);

      // Informações dos filtros aplicados
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      let filterInfo: string[] = [];
      if (statusFilter !== 'all') {
        const statusLabel = SWAP_STATUS_CONFIG[statusFilter as keyof typeof SWAP_STATUS_CONFIG]?.label || statusFilter;
        filterInfo.push(`Status: ${statusLabel}`);
      }
      if (monthFilter !== 'all') {
        const [year, m] = monthFilter.split('-');
        const date = new Date(Number(year), Number(m) - 1, 1);
        filterInfo.push(`Mês: ${format(date, 'MMMM yyyy', { locale: ptBR })}`);
      }
      if (teamFilter !== 'all') {
        const team = teams.find(t => t.id === teamFilter);
        filterInfo.push(`Equipe: ${team?.name || teamFilter}`);
      }
      if (dateFrom || dateTo) {
        const fromStr = dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : '...';
        const toStr = dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: ptBR }) : '...';
        filterInfo.push(`Período: ${fromStr} a ${toStr}`);
      }
      
      doc.text(filterInfo.length > 0 ? filterInfo.join(' | ') : 'Todos os registros', 45, 28);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 45, 34);

      // Resumo
      const filteredStats = {
        total: filteredAndSortedRequests.length,
        pending: filteredAndSortedRequests.filter(r => r.status === 'PENDING').length,
        accepted: filteredAndSortedRequests.filter(r => r.status === 'ACCEPTED').length,
        approved: filteredAndSortedRequests.filter(r => r.status === 'APPROVED').length,
        rejected: filteredAndSortedRequests.filter(r => r.status === 'REJECTED').length,
        cancelled: filteredAndSortedRequests.filter(r => r.status === 'CANCELLED').length,
      };

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Resumo', 14, 48);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Total: ${filteredStats.total} | Pendentes: ${filteredStats.pending} | Aceitas: ${filteredStats.accepted} | Aprovadas: ${filteredStats.approved} | Rejeitadas: ${filteredStats.rejected} | Canceladas: ${filteredStats.cancelled}`,
        14, 54
      );

      // Tabela com autoTable
      const tableData = filteredAndSortedRequests.map(req => [
        req.requester?.name || '-',
        req.requester?.team?.name || '-',
        req.target?.name || '-',
        req.target?.team?.name || '-',
        `${format(parseDateOnly(req.requester_shift_date), 'dd/MM/yy', { locale: ptBR })} → ${format(parseDateOnly(req.target_shift_date), 'dd/MM/yy', { locale: ptBR })}`,
        SWAP_STATUS_CONFIG[req.status as keyof typeof SWAP_STATUS_CONFIG]?.label || req.status,
        format(new Date(req.created_at), 'dd/MM/yy', { locale: ptBR }),
      ]);

      autoTable(doc, {
        startY: 60,
        head: [['Solicitante', 'Equipe', 'Convidado', 'Equipe', 'Datas Troca', 'Status', 'Criado em']],
        body: tableData,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 18 },
          2: { cellWidth: 26 },
          3: { cellWidth: 18 },
          4: { cellWidth: 38 },
          5: { cellWidth: 18 },
          6: { cellWidth: 16 },
        },
        didDrawPage: (data) => {
          // Rodapé com número da página
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            doc.internal.pageSize.width - 30,
            doc.internal.pageSize.height - 10
          );
        },
      });

      // Assinatura
      const finalY = (doc as any).lastAutoTable?.finalY || 150;
      if (finalY < doc.internal.pageSize.height - 60) {
        doc.setFontSize(9);
        doc.line(14, finalY + 30, 80, finalY + 30);
        doc.text('Coordenador(a)', 14, finalY + 36);
        doc.text(`Data: ____/____/________`, 100, finalY + 36);
      }

      // Salvar PDF
      doc.save(`relatorio-trocas-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);

      toast({
        title: 'Relatório gerado',
        description: `PDF com ${filteredAndSortedRequests.length} solicitações gerado com sucesso.`,
      });
    } catch (error) {
      console.error('[AdminSwaps][GenerateReport]', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível gerar o relatório PDF.',
        variant: 'destructive',
      });
    }
  };

  // Agrupar solicitações pelos meses envolvidos (requester_shift_date e target_shift_date)
  const groupedByMonth = filteredAndSortedRequests.reduce((acc, request) => {
    const getMonthKey = (dateStr: string | null | undefined) => {
      if (!dateStr) return null;
      const [y, m] = dateStr.split('-');
      if (!y || !m) return null;
      return `${y}-${m}`;
    };

    const months = new Set<string>();
    const m1 = getMonthKey(request.requester_shift_date);
    const m2 = getMonthKey(request.target_shift_date);
    if (m1) months.add(m1);
    if (m2) months.add(m2);

    months.forEach((key) => {
      if (!acc[key]) acc[key] = [];
      acc[key].push(request);
    });

    return acc;
  }, {} as Record<string, SwapRequest[]>);

  // Ordenar as chaves dos meses (mais recente primeiro)
  const sortedMonthKeys = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));

  // Solicitações aguardando aprovação do admin (aceitas pelo segurança)
  const pendingApproval = useMemo(() => {
    return filteredAndSortedRequests.filter(
      (r) => r.status === 'ACCEPTED' && r.target_confirmation
    );
  }, [filteredAndSortedRequests]);

  if (loading) {
    return (
      <AppLayout title="Gerenciar Trocas" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando solicitações...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Gerenciar Trocas" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
      {/* Back to Dashboard Button */}
      <div className="mb-6">
        <Link to="/dashboard/admin">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Ciência</CardTitle>
            <AlertCircle className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{stats.needConfirmation}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
            <XCircle className="h-4 w-4 text-danger" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Filtros e Ordenação</CardTitle>
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={generateSwapsReportPDF} 
                size="sm"
                className="gap-2"
                disabled={filteredAndSortedRequests.length === 0}
              >
                <FileText className="h-4 w-4" />
                Gerar Relatório
              </Button>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2 text-muted-foreground">
                  <X className="h-4 w-4" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Row 1: Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou motivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Row 2: Status, Month, Team */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="ACCEPTED">Aceita</SelectItem>
                  <SelectItem value="APPROVED">Aprovada</SelectItem>
                  <SelectItem value="REJECTED">Rejeitada</SelectItem>
                  <SelectItem value="CANCELLED">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mês de Referência</Label>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os meses</SelectItem>
                  {availableMonths.map((month) => {
                    const [year, m] = month.split('-');
                    const date = new Date(Number(year), Number(m) - 1, 1);
                    return (
                      <SelectItem key={month} value={month}>
                        {format(date, 'MMMM yyyy', { locale: ptBR })}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Equipe</Label>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipes</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: team.color || '#3b82f6' }}
                        />
                        {team.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Sort and Date Range */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ordenar por</Label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger>
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Data de Criação</SelectItem>
                  <SelectItem value="requester_name">Solicitante (A-Z)</SelectItem>
                  <SelectItem value="target_name">Convidado (A-Z)</SelectItem>
                  <SelectItem value="requester_shift_date">Data do Plantão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ordem</Label>
              <Button
                variant="outline"
                onClick={toggleSortOrder}
                className="w-full justify-between"
              >
                {sortOrder === 'desc' ? (
                  <>
                    <span>Decrescente</span>
                    <ArrowDown className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <span>Crescente</span>
                    <ArrowUp className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Criado a partir de</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Criado até</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Results count */}
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Exibindo <span className="font-medium text-foreground">{filteredAndSortedRequests.length}</span> de{' '}
              <span className="font-medium text-foreground">{swapRequests.length}</span> solicitações
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Mobile: Pending Approval Card */}
      {pendingApproval.length > 0 && (
        <Card className="md:hidden mb-6 border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <CardTitle className="text-base">Aguardando Sua Aprovação</CardTitle>
              <Badge variant="secondary" className="ml-auto">
                {pendingApproval.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {pendingApproval.map((request) => (
              <div key={`mobile-pending-${request.id}`} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-background border">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {request.requester?.name} → {request.target?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseDateOnly(request.requester_shift_date), 'dd/MM', { locale: ptBR })}
                    {' → '}
                    {format(parseDateOnly(request.target_shift_date), 'dd/MM', { locale: ptBR })}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="icon"
                    className="h-8 w-8 bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => openDecisionDialog(request, 'approve')}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 text-danger hover:bg-danger hover:text-danger-foreground"
                    onClick={() => openDecisionDialog(request, 'reject')}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Swap Requests List */}
      <div className="space-y-6">
        {sortedMonthKeys.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle className="mb-2">Nenhuma solicitação encontrada</CardTitle>
              <CardDescription>
                {searchTerm || statusFilter !== 'all' || monthFilter !== 'all' || teamFilter !== 'all' || dateFrom || dateTo
                  ? 'Nenhuma solicitação corresponde aos critérios de busca.'
                  : 'Não há solicitações de troca no momento.'}
              </CardDescription>
              {activeFiltersCount > 0 && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          sortedMonthKeys.map((monthKey) => {
            const monthRequests = groupedByMonth[monthKey];
            const [year, month] = monthKey.split('-');
            const monthDate = new Date(Number(year), Number(month) - 1, 1);
            const monthLabel = format(monthDate, 'MMMM yyyy', { locale: ptBR });
            
            return (
              <div key={monthKey} className="space-y-4">
                <div className="flex items-center gap-3 pb-2 border-b-2 border-primary/20">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold capitalize">{monthLabel}</h2>
                  <Badge variant="secondary" className="ml-auto">
                    {monthRequests.length} {monthRequests.length === 1 ? 'solicitação' : 'solicitações'}
                  </Badge>
                </div>
                
                <div className="space-y-4">
                  {monthRequests.map((request) => (
                    <Card key={request.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="secondary" className="font-mono text-xs">
                                Protocolo: {request.id.slice(0, 8)}
                              </Badge>
                              <StatusBadge status={request.status} />
                              {!request.target_confirmation && request.status !== 'PENDING' && (
                                <Badge variant="outline" className="text-warning border-warning">
                                  Aguardando Ciência
                                </Badge>
                              )}
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <div>
                                <div className="text-sm text-muted-foreground">Solicitante</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{request.requester?.name}</span>
                                  {request.requester?.team && (
                                    <TeamBadge team={request.requester.team} />
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground">Membro Convidado</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{request.target?.name}</span>
                                  {request.target?.team && (
                                    <TeamBadge team={request.target.team} />
                                  )}
                                </div>
                              </div>
                            </div>

                            <div>
                              <div className="text-sm text-muted-foreground">Datas da Troca</div>
                              <div className="font-medium text-sm">
                                {format(parseDateOnly(request.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                                {' → '}
                                {format(parseDateOnly(request.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Plantão do solicitante → Plantão desejado
                              </div>
                            </div>

                            <div>
                              <div className="text-sm text-muted-foreground">Motivo</div>
                              <div className="text-sm">{request.reason}</div>
                            </div>

                            <div className="text-xs text-muted-foreground">
                              Solicitado em {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 lg:w-auto w-full">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => generatePDF(request)}
                              className="gap-2"
                            >
                              <FileDown className="h-4 w-4" />
                              PDF
                            </Button>
                            
                            {request.status === 'ACCEPTED' && request.target_confirmation && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => openDecisionDialog(request, 'approve')}
                                  className="gap-2 bg-success hover:bg-success/90 text-success-foreground"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Aprovar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDecisionDialog(request, 'reject')}
                                  className="gap-2 text-danger hover:bg-danger hover:text-danger-foreground"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Rejeitar
                                </Button>
                              </>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDeleteDialog(request)}
                              className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Decision Dialog */}
      <Dialog open={isDecisionDialogOpen} onOpenChange={setIsDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionAction === 'approve' ? 'Aprovar' : 'Rejeitar'} Solicitação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Troca entre</div>
              <div className="font-medium">
                {selectedRequest?.requester?.name} ↔ {selectedRequest?.target?.name}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Datas: {selectedRequest && (
                  <>
                    {format(parseDateOnly(selectedRequest.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                    {' → '}
                    {format(parseDateOnly(selectedRequest.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="reason">
                {decisionAction === 'approve' ? 'Observações (opcional)' : 'Motivo da rejeição'}
              </Label>
              <Textarea
                id="reason"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder={
                  decisionAction === 'approve'
                    ? 'Observações sobre a aprovação...'
                    : 'Explique o motivo da rejeição...'
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDecisionDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDecision}
              className={decisionAction === 'approve' ? 'bg-success hover:bg-success/90' : 'bg-danger hover:bg-danger/90'}
            >
              {decisionAction === 'approve' ? 'Aprovar' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir esta solicitação de troca? Esta ação não pode ser desfeita.
            </p>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Troca entre</div>
              <div className="font-medium">
                {requestToDelete?.requester?.name} ↔ {requestToDelete?.target?.name}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Datas: {requestToDelete && (
                  <>
                    {format(parseDateOnly(requestToDelete.requester_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                    {' → '}
                    {format(parseDateOnly(requestToDelete.target_shift_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              variant="destructive"
            >
              Excluir Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminSwaps;
