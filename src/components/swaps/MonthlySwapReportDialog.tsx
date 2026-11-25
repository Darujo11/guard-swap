import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { buildMonthlySwapReport, formatMonthLabel, getMonthRange, type ReportSwap } from '@/utils/monthlySwapReport';
import { downloadMonthlySwapReport } from '@/utils/monthlySwapReportPdf';
import { loadLogoDataUrl } from '@/utils/printSwapReceipt';

interface MonthlySwapReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Perfil do coordenador: é a organização do relatório. */
  adminId: string;
  coordinatorName: string;
}

async function fetchApprovedSwaps(adminId: string, monthKey: string): Promise<ReportSwap[]> {
  const { start, end } = getMonthRange(monthKey);
  const { data, error } = await supabase
    .from('swap_requests')
    .select(`
      id, requester_id, target_id, requester_shift_date, target_shift_date, status, admin_approved_at,
      requester:profiles!swap_requests_requester_id_fkey(name, team:teams(name)),
      target:profiles!swap_requests_target_id_fkey(name, team:teams(name)),
      admin_approver:profiles!swap_requests_admin_approved_by_fkey(name)
    `)
    .eq('admin_id', adminId)
    .eq('status', 'APPROVED')
    .or(
      `and(requester_shift_date.gte.${start},requester_shift_date.lte.${end}),` +
        `and(target_shift_date.gte.${start},target_shift_date.lte.${end})`
    );

  if (error) throw error;
  return (data ?? []) as unknown as ReportSwap[];
}

/** Escolhe o mês e baixa o PDF das trocas aprovadas com plantão nele. */
export function MonthlySwapReportDialog({ open, onOpenChange, adminId, coordinatorName }: MonthlySwapReportDialogProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const monthKey = format(month, 'yyyy-MM');
  const monthLabel = formatMonthLabel(monthKey);

  const { data: swaps, isFetching, isError, refetch } = useQuery({
    queryKey: ['monthly-swap-report', adminId, monthKey],
    queryFn: () => fetchApprovedSwaps(adminId, monthKey),
    enabled: open && !!adminId,
    retry: 1,
  });

  const report = useMemo(() => (swaps ? buildMonthlySwapReport(swaps, monthKey) : null), [swaps, monthKey]);
  const total = report?.rows.length ?? 0;

  const handleGenerate = async () => {
    if (!report || total === 0) return;
    setGenerating(true);
    try {
      const logoDataUrl = await loadLogoDataUrl();
      downloadMonthlySwapReport(report, { coordinatorName, logoDataUrl });
      toast({
        title: 'Relatório gerado',
        description: `${monthLabel}: ${total} ${total === 1 ? 'troca aprovada' : 'trocas aprovadas'}.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('[MonthlySwapReportDialog][Generate]', error);
      toast({
        title: 'Erro ao gerar relatório',
        description: 'Não foi possível gerar o PDF das trocas.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório mensal de trocas</DialogTitle>
          <DialogDescription>
            PDF com todas as trocas aprovadas que têm plantão no mês escolhido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Mês anterior"
              onClick={() => setMonth((current) => subMonths(current, 1))}
              disabled={generating}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 rounded-md border py-2 text-center text-sm font-medium" aria-live="polite">
              {monthLabel}
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próximo mês"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              disabled={generating}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex min-h-9 items-center justify-center text-center text-sm text-muted-foreground" aria-live="polite">
            {isFetching ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando trocas...
              </span>
            ) : isError ? (
              <span className="flex items-center gap-2 text-destructive">
                Não foi possível buscar as trocas.
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Tentar de novo
                </Button>
              </span>
            ) : total === 0 ? (
              'Nenhuma troca aprovada neste mês.'
            ) : (
              <span>
                <strong className="text-foreground">{total}</strong>{' '}
                {total === 1 ? 'troca aprovada' : 'trocas aprovadas'} ·{' '}
                <strong className="text-foreground">{report?.peopleCount}</strong> profissionais envolvidos
              </span>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={isFetching || isError || generating || total === 0} className="gap-2">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {generating ? 'Gerando...' : 'Gerar PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
