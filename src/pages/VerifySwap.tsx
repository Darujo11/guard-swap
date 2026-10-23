import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, Search, ShieldCheck, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import type { SwapStatus } from '@/lib/types';
import {
  SWAP_SIGNATURE_ACTION_LABELS,
  SWAP_SIGNER_ROLE_LABELS,
  type SwapSignatureAction,
  type SwapSignerRole,
} from '@/lib/swapSignatureText';
import logoCamara from '@/assets/logo-camara-documento.png';

/** Resposta de verify_swap_document (dados mínimos, página pública). */
interface VerificationResult {
  found: boolean;
  code?: string;
  protocol?: string;
  requester?: string | null;
  target?: string | null;
  requester_shift_date?: string;
  target_shift_date?: string;
  swap_exists?: boolean;
  status?: SwapStatus | null;
  terms_match?: boolean;
  signatures?: { action: string; role: string; name: string | null; signed_at: string }[];
}

const formatDateOnly = (value?: string) => {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'dd/MM/yyyy');
};

const normalizeCode = (value: string) => {
  const hex = value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 10);
  return hex.length > 5 ? `${hex.slice(0, 5)}-${hex.slice(5)}` : hex;
};

export default function VerifySwap() {
  const { code: codeParam } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [input, setInput] = useState(codeParam ? normalizeCode(codeParam) : '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!codeParam) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    supabase
      .rpc('verify_swap_document', { p_code: codeParam })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[VerifySwap]', error);
          setFailed(true);
          setResult(null);
        } else {
          setResult(data as unknown as VerificationResult);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [codeParam]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeCode(input);
    if (code.length === 11) navigate(`/verificar/${code}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-start sm:items-center justify-center p-4 py-10">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex justify-center">
          <img src={logoCamara} alt="Câmara Municipal de Macaé" className="h-14 w-auto" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verificar comprovante de troca
            </CardTitle>
            <CardDescription>
              Digite o código de verificação impresso no comprovante para conferir as assinaturas eletrônicas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="codigo">Código de verificação</Label>
                <Input
                  id="codigo"
                  value={input}
                  onChange={(e) => setInput(normalizeCode(e.target.value))}
                  placeholder="XXXXX-XXXXX"
                  className="font-mono tracking-wider uppercase"
                  autoComplete="off"
                  inputMode="text"
                />
              </div>
              <Button type="submit" disabled={normalizeCode(input).length !== 11 || loading}>
                <Search className="h-4 w-4 mr-2" />
                Verificar
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading && <p className="text-center text-sm text-muted-foreground">Verificando…</p>}

        {!loading && failed && (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 flex gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
              <p className="text-sm">Não foi possível verificar agora. Tente novamente em instantes.</p>
            </CardContent>
          </Card>
        )}

        {!loading && result && !result.found && (
          <Card className="border-destructive/40">
            <CardContent className="pt-6 flex gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">Código não encontrado</p>
                <p className="text-muted-foreground">
                  Confira se o código foi digitado corretamente. Comprovantes sem código são anteriores à assinatura eletrônica.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && result?.found && (
          <Card className={result.terms_match ? 'border-success/40' : 'border-warning/50'}>
            <CardHeader>
              {result.terms_match ? (
                <div className="flex gap-3">
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                  <div>
                    <CardTitle className="text-success text-lg">Assinaturas válidas</CardTitle>
                    <CardDescription>Os termos da troca são os mesmos que foram assinados.</CardDescription>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <AlertTriangle className="h-6 w-6 text-warning shrink-0" />
                  <div>
                    <CardTitle className="text-warning text-lg">
                      {result.swap_exists ? 'Termos não conferem' : 'Troca excluída do sistema'}
                    </CardTitle>
                    <CardDescription>
                      {result.swap_exists
                        ? 'A troca registrada hoje não corresponde aos termos assinados. Procure a coordenação.'
                        : 'As assinaturas abaixo continuam registradas, mas a troca não existe mais no sistema.'}
                    </CardDescription>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Protocolo</dt>
                  <dd className="font-mono font-semibold">{result.protocol}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Situação</dt>
                  <dd>{result.status ? <StatusBadge status={result.status} /> : '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Plantão de {result.requester ?? 'solicitante'}</dt>
                  <dd className="font-medium">{formatDateOnly(result.requester_shift_date)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Plantão de {result.target ?? 'colega'}</dt>
                  <dd className="font-medium">{formatDateOnly(result.target_shift_date)}</dd>
                </div>
              </dl>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Assinaturas eletrônicas
                </h3>
                <ul className="divide-y rounded-lg border">
                  {(result.signatures ?? []).map((sig, index) => (
                    <li key={index} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <div>
                        <div className="font-medium">{sig.name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {SWAP_SIGNER_ROLE_LABELS[sig.role as SwapSignerRole] ?? sig.role}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {SWAP_SIGNATURE_ACTION_LABELS[sig.action as SwapSignatureAction] ?? sig.action}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {format(new Date(sig.signed_at), "dd/MM/yyyy 'às' HH:mm:ss")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-muted-foreground">
                Código {result.code}. Por privacidade, esta página mostra apenas o primeiro nome e a inicial do sobrenome.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
