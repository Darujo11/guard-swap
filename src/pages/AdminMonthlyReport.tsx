import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addMonths, format, startOfMonth, subMonths } from 'date-fns';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  buildMonthlyDutyReport,
  getTeamCalendarColor,
  type DutyEntry,
  type DutyReportDay,
  type DutyReportInput,
  type MonthlyDutyReport,
  type ObservationLine,
} from '@/utils/monthlyDutyReport';
import {
  buildMonthlyDutyReportPdf,
  monthlyDutyReportFileName,
  type MonthlyDutyReportNotes,
} from '@/utils/monthlyDutyReportPdf';
import { formatMonthLabel, getMonthRange } from '@/utils/monthlySwapReport';
import { loadLogoDataUrl } from '@/utils/printSwapReceipt';

/* -------------------------------------------------------------------------- */
/*  Dados                                                                      */
/* -------------------------------------------------------------------------- */

async function fetchMonthData(adminId: string, monthKey: string): Promise<DutyReportInput> {
  const { start, end } = getMonthRange(monthKey);

  const [teams, guards, schedules, swaps, leaves, extras] = await Promise.all([
    supabase.from('teams').select('id, name, color').eq('admin_id', adminId),
    supabase.from('profiles').select('id, name, team_id, is_active, is_shift_chief').eq('admin_id', adminId),
    supabase
      .from('team_schedules')
      .select('team_id, shift_date')
      .eq('admin_id', adminId)
      .gte('shift_date', start)
      .lte('shift_date', end),
    supabase
      .from('swap_requests')
      .select('id, requester_id, target_id, requester_shift_date, target_shift_date, status')
      .eq('admin_id', adminId)
      .eq('status', 'APPROVED')
      .or(
        `and(requester_shift_date.gte.${start},requester_shift_date.lte.${end}),` +
          `and(target_shift_date.gte.${start},target_shift_date.lte.${end})`
      ),
    // Pendentes vêm só para o aviso de TRE sem decisão; a escala usa os aprovados.
    supabase
      .from('leaves')
      .select('id, guard_id, start_date, end_date, leave_type, custom_type, status')
      .eq('admin_id', adminId)
      .in('status', ['APPROVED', 'PENDING'])
      .lte('start_date', end)
      .gte('end_date', start),
    supabase
      .from('extras')
      .select('id, guard_id, extra_date, quantity, minutes, percentage_type, justification')
      .eq('admin_id', adminId)
      .gte('extra_date', start)
      .lte('extra_date', end),
  ]);

  // Qualquer falha invalida o relatório: sem uma das partes ele mostraria gente de plantão que não estava.
  for (const result of [teams, guards, schedules, swaps, leaves, extras]) {
    if (result.error) throw result.error;
  }

  return {
    monthKey,
    teams: teams.data ?? [],
    guards: guards.data ?? [],
    schedules: schedules.data ?? [],
    swaps: swaps.data ?? [],
    leaves: leaves.data ?? [],
    extras: extras.data ?? [],
  };
}

/* -------------------------------------------------------------------------- */
/*  Observações digitadas (rascunho por mês, só neste navegador)               */
/* -------------------------------------------------------------------------- */

const EMPTY_NOTES: MonthlyDutyReportNotes = { noOvertime: '', events: '', other: '' };
const NOTE_MAX_LENGTH = 600;

const notesStorageKey = (adminId: string, monthKey: string) => `escalasmart:relatorio-mensal:${adminId}:${monthKey}`;

function readNotes(key: string | null): MonthlyDutyReportNotes {
  if (!key) return EMPTY_NOTES;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_NOTES;
    const parsed = JSON.parse(raw) as Partial<MonthlyDutyReportNotes>;
    return {
      noOvertime: typeof parsed.noOvertime === 'string' ? parsed.noOvertime : '',
      events: typeof parsed.events === 'string' ? parsed.events : '',
      other: typeof parsed.other === 'string' ? parsed.other : '',
    };
  } catch {
    return EMPTY_NOTES;
  }
}

function writeNotes(key: string | null, notes: MonthlyDutyReportNotes) {
  if (!key) return;
  try {
    const empty = !notes.noOvertime.trim() && !notes.events.trim() && !notes.other.trim();
    if (empty) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(notes));
  } catch {
    // Navegação privada ou armazenamento cheio: o texto continua valendo até sair da página.
  }
}

/* -------------------------------------------------------------------------- */
/*  Grade                                                                      */
/* -------------------------------------------------------------------------- */

const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

function entryTitle(entry: DutyEntry): string {
  const parts: string[] = [entry.name];
  if (entry.swap) {
    const other = entry.swap.otherDate ? `, em troca de ${dayMonth(entry.swap.otherDate)}` : '';
    parts.push(`Assumiu o plantão de ${entry.swap.withName} (${entry.swap.protocol}${other})`);
  }
  if (entry.status === 'absent') parts.push(entry.leave?.label ?? 'Afastamento');
  if (entry.extra) {
    const why = entry.extra.justification ? `: ${entry.extra.justification}` : '';
    parts.push(`Extra de ${entry.extra.hours} (${entry.extra.percentage}%)${why}`);
  }
  return parts.join(' · ');
}

function EntryRow({ entry }: { entry: DutyEntry }) {
  const absent = entry.status === 'absent';
  const extraOnly = entry.status === 'extra';

  let tag: React.ReactNode = null;
  if (extraOnly) {
    tag = <span className="shrink-0 text-[10px] font-bold tracking-wide">EXTRA</span>;
  } else if (absent) {
    tag = (
      <span
        className={cn(
          'shrink-0 text-[10px] font-bold',
          entry.leave?.category === 'BANCO_HORAS' ? 'text-slate-600 dark:text-slate-300' : 'text-red-700 dark:text-red-400'
        )}
      >
        {entry.leave?.code ?? 'AFAST.'}
      </span>
    );
  } else if (entry.extra) {
    tag = (
      <span className="shrink-0 rounded-sm bg-yellow-300 px-1 text-[10px] font-bold text-yellow-950">+EXTRA</span>
    );
  } else if (entry.swap) {
    tag = (
      <span className="min-w-0 shrink truncate text-[10px] text-blue-700 dark:text-blue-400">c/ {entry.swap.withName}</span>
    );
  }

  return (
    <li
      title={entryTitle(entry)}
      className={cn(
        'flex items-center justify-between gap-1 rounded-sm px-1.5 py-[3px] text-[11px] leading-tight',
        extraOnly && 'bg-yellow-300 text-yellow-950'
      )}
    >
      <span
        className={cn(
          'min-w-0 truncate uppercase',
          absent && 'text-muted-foreground line-through decoration-1',
          !absent && entry.swap && 'font-semibold text-blue-700 dark:text-blue-400',
          extraOnly && 'font-semibold'
        )}
      >
        {entry.name}
      </span>
      {tag}
    </li>
  );
}

function DayCell({ day, isToday }: { day: DutyReportDay; isToday: boolean }) {
  const teamLabel = day.teams.map((team) => team.name).join(' / ');
  const teamColor = day.teams[0] ? getTeamCalendarColor(day.teams[0].name, day.teams[0].color) : undefined;

  return (
    <article
      aria-label={`${day.weekdayLabel}, ${day.dayOfMonth}`}
      className={cn(
        'flex min-h-[156px] flex-col overflow-hidden rounded-md border bg-card',
        isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
      )}
    >
      {/* Na grade larga o dia da semana já está no cabeçalho da coluna; na lista (celular) vai no dia. */}
      <header className="flex items-baseline justify-between gap-1 border-b bg-muted/60 px-2 py-1">
        <span className="truncate text-[11px] text-muted-foreground lg:hidden">{day.weekdayLabel}</span>
        <span className="text-sm font-semibold tabular-nums lg:ml-auto">{day.dayOfMonth}</span>
      </header>
      <div className="flex items-center gap-1.5 border-b px-2 py-1 text-[11px] font-semibold">
        {teamColor ? (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: teamColor }} aria-hidden />
            <span className="truncate">{teamLabel}</span>
          </>
        ) : (
          <span className="font-normal italic text-muted-foreground">Sem escala</span>
        )}
      </div>
      <ul className="flex-1 space-y-px p-1">
        {day.entries.map((entry) => (
          <EntryRow key={`${entry.guardId}-${entry.status}`} entry={entry} />
        ))}
      </ul>
    </article>
  );
}

function MonthGrid({ report }: { report: MonthlyDutyReport }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return (
    <div>
      <div className="mb-2 hidden grid-cols-7 gap-1.5 lg:grid">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className="text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-7">
        {report.weeks.flatMap((week, row) =>
          week.map((day, col) =>
            day ? (
              <DayCell key={day.date} day={day} isToday={day.date === today} />
            ) : (
              <div key={`pad-${row}-${col}`} className="hidden lg:block" aria-hidden />
            )
          )
        )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="font-semibold text-blue-700 dark:text-blue-400">NOME</span>
        plantão assumido em troca
      </span>
      <span className="flex items-center gap-1.5">
        <span className="line-through">NOME</span>
        <span className="font-bold text-red-700 dark:text-red-400">ATESTADO</span>
        afastado ou de folga (BH = banco de horas)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded-sm bg-yellow-300 px-1.5 font-bold text-yellow-950">EXTRA</span>
        fez extra no dia
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Observações                                                                */
/* -------------------------------------------------------------------------- */

function AutoSection({ title, lines }: { title: string; lines: ObservationLine[] }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-medium">{title}</h3>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro no mês.</p>
      ) : (
        <ul className="space-y-0.5 text-sm">
          {lines.map((line) => (
            <li key={`${line.guardId}-${line.detail ?? ''}`}>
              <span className="font-medium">{line.name}</span>
              <span className="text-muted-foreground">
                {line.detail ? ` – ${line.detail}` : ''} – {line.dates}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ManualSection({
  id,
  title,
  value,
  placeholder,
  onChange,
}: {
  id: keyof MonthlyDutyReportNotes;
  title: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="space-y-1.5">
      <Label htmlFor={`nota-${id}`} className="text-sm font-medium">
        {title}
      </Label>
      <Textarea
        id={`nota-${id}`}
        value={value}
        placeholder={placeholder}
        maxLength={NOTE_MAX_LENGTH}
        rows={2}
        className="min-h-[60px] resize-y text-sm"
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Página                                                                     */
/* -------------------------------------------------------------------------- */

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AdminMonthlyReport() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const adminId = profile?.admin_id || profile?.id || null;

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [includeDetail, setIncludeDetail] = useState(true);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, MonthlyDutyReportNotes>>({});

  const monthKey = format(month, 'yyyy-MM');
  const monthLabel = formatMonthLabel(monthKey);
  const storageKey = adminId ? notesStorageKey(adminId, monthKey) : null;
  const notes = (storageKey && drafts[storageKey]) || readNotes(storageKey);

  // A logo é carregada antes do clique: imprimir abre janela, e o navegador bloqueia janela aberta depois de espera.
  useEffect(() => {
    let active = true;
    loadLogoDataUrl().then((url) => active && setLogoDataUrl(url));
    return () => {
      active = false;
    };
  }, []);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['monthly-duty-report', adminId, monthKey],
    queryFn: () => fetchMonthData(adminId!, monthKey),
    enabled: !!adminId,
    retry: 1,
  });

  const report = useMemo(() => (data ? buildMonthlyDutyReport(data) : null), [data]);
  const canExport = !!report && report.totals.daysWithTeam > 0 && !isFetching;

  const setNote = (field: keyof MonthlyDutyReportNotes, value: string) => {
    if (!storageKey) return;
    const next = { ...notes, [field]: value };
    setDrafts((current) => ({ ...current, [storageKey]: next }));
    writeNotes(storageKey, next);
  };

  const buildPdf = () =>
    buildMonthlyDutyReportPdf(report!, {
      coordinatorName: profile?.name || 'Coordenação',
      logoDataUrl,
      notes,
      includeDetail,
    });

  const handleDownload = () => {
    if (!canExport) return;
    try {
      buildPdf().save(monthlyDutyReportFileName(report!));
      toast({ title: 'Relatório gerado', description: `Escala de ${monthLabel}.` });
    } catch (error) {
      console.error('[AdminMonthlyReport][Download]', error);
      toast({ title: 'Erro ao gerar o PDF', description: 'Tente de novo.', variant: 'destructive' });
    }
  };

  const handlePrint = () => {
    if (!canExport) return;
    try {
      const doc = buildPdf();
      doc.autoPrint();
      const url = String(doc.output('bloburl'));
      const printWindow = window.open(url, '_blank');
      if (!printWindow) {
        doc.save(monthlyDutyReportFileName(report!));
        toast({
          title: 'O navegador bloqueou a janela de impressão',
          description: 'O PDF foi baixado. Abra o arquivo para imprimir.',
        });
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (error) {
      console.error('[AdminMonthlyReport][Print]', error);
      toast({ title: 'Erro ao preparar a impressão', description: 'Tente de novo.', variant: 'destructive' });
    }
  };

  const warnings = report?.warnings;
  const hasWarnings =
    !!warnings &&
    (warnings.pendingTre.length > 0 ||
      warnings.leavesWithoutShift.length > 0 ||
      (warnings.daysWithoutTeam.length > 0 && report!.totals.daysWithTeam > 0));

  return (
    <AppLayout title="Relatório Mensal" user={{ name: profile?.name || 'Admin', role: 'ADMIN' }}>
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        {/* Mês e ações */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Mês anterior"
                onClick={() => setMonth((current) => subMonths(current, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[190px] text-center" aria-live="polite">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Escala de</p>
                <p className="text-lg font-semibold">{monthLabel}</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="Próximo mês"
                onClick={() => setMonth((current) => addMonths(current, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Atualizar dados"
                title="Atualizar dados"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="incluir-detalhamento"
                  checked={includeDetail}
                  onCheckedChange={(checked) => setIncludeDetail(checked === true)}
                />
                <Label htmlFor="incluir-detalhamento" className="text-sm font-normal">
                  Incluir detalhamento diário
                </Label>
              </div>
              <Button variant="outline" className="gap-2" onClick={handlePrint} disabled={!canExport}>
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button className="gap-2" onClick={handleDownload} disabled={!canExport}>
                <FileDown className="h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível carregar a escala do mês</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              Sem todos os dados o relatório poderia mostrar alguém de plantão que não estava.
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Tentar de novo
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[84px]" />
              ))}
            </div>
            <Skeleton className="h-[640px]" />
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Dias com escala"
                value={`${report.totals.daysWithTeam}/${report.days.length}`}
              />
              <Stat label="Trocas aprovadas" value={report.totals.swaps} />
              <Stat label="Afastamentos e folgas" value={report.totals.absences} hint="plantões não trabalhados" />
              <Stat label="Extras" value={report.totals.extras} hint="lançamentos no mês" />
            </div>

            {hasWarnings && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4 !text-amber-600" />
                <AlertTitle>Confira antes de imprimir</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {warnings!.pendingTre.length > 0 && (
                      <li>
                        TRE aguardando decisão:{' '}
                        {warnings!.pendingTre.map((item) => `${item.guardName} (${item.dates})`).join(', ')}. Enquanto
                        não for decidido, a pessoa aparece de plantão.{' '}
                        <Link to="/dashboard/admin" className="font-medium underline underline-offset-2">
                          Decidir no painel
                        </Link>
                      </li>
                    )}
                    {warnings!.leavesWithoutShift.length > 0 && (
                      <li>
                        Afastamentos em dia sem plantão da pessoa (não aparecem na escala):{' '}
                        {warnings!.leavesWithoutShift
                          .map((item) => `${item.guardName} – ${item.label} (${item.dates})`)
                          .join('; ')}
                        .{' '}
                        <Link to="/admin/folgas" className="font-medium underline underline-offset-2">
                          Ver afastamentos
                        </Link>
                      </li>
                    )}
                    {warnings!.daysWithoutTeam.length > 0 && report.totals.daysWithTeam > 0 && (
                      <li>
                        Dias sem equipe na escala: {warnings!.daysWithoutTeam.map(dayMonth).join(', ')}.{' '}
                        <Link to="/admin/escalas" className="font-medium underline underline-offset-2">
                          Ajustar escala
                        </Link>
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card className="min-w-0">
                <CardHeader className="gap-3 pb-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CalendarDays className="h-5 w-5" />
                      Quem esteve de plantão
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Escala da equipe com as trocas aprovadas, os afastamentos e as extras do dia. Passe o mouse sobre
                      um nome para ver o detalhe.
                    </CardDescription>
                  </div>
                  <Legend />
                </CardHeader>
                <CardContent>
                  {report.totals.daysWithTeam === 0 ? (
                    <div className="rounded-md border border-dashed py-16 text-center">
                      <p className="font-medium">Nenhuma escala cadastrada para {monthLabel}.</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Cadastre as equipes do mês para gerar o relatório.
                      </p>
                      <Button variant="outline" size="sm" className="mt-4" asChild>
                        <Link to="/admin/escalas">Gerenciar escala</Link>
                      </Button>
                    </div>
                  ) : (
                    <MonthGrid report={report} />
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0 self-start">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Observações</CardTitle>
                  <CardDescription>
                    Os afastamentos entram sozinhos. Os campos de texto saem no PDF e ficam salvos só neste navegador.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <ManualSection
                    id="noOvertime"
                    title="Servidores que não podem fazer hora extra"
                    value={notes.noOvertime}
                    placeholder="Ex.: Fulano (restrição médica)"
                    onChange={(value) => setNote('noOvertime', value)}
                  />
                  <AutoSection
                    title="Servidores com horas para folga (Banco de Horas)"
                    lines={report.observations.hourBank}
                  />
                  <AutoSection title="Servidores em férias" lines={report.observations.vacation} />
                  <AutoSection title="Servidores com folga de TRE" lines={report.observations.tre} />
                  <AutoSection title="Servidores com atestado médico" lines={report.observations.medical} />
                  {report.observations.other.length > 0 && (
                    <AutoSection title="Outros afastamentos" lines={report.observations.other} />
                  )}
                  <ManualSection
                    id="events"
                    title="Eventos diversos (reuniões, audiências etc)"
                    value={notes.events}
                    placeholder="Ex.: 10/12 – sessão solene, reforço de 2 servidores"
                    onChange={(value) => setNote('events', value)}
                  />
                  <ManualSection
                    id="other"
                    title="Demais observações"
                    value={notes.other}
                    placeholder="Opcional"
                    onChange={(value) => setNote('other', value)}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
