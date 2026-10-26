import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { supabase } from '@/integrations/supabase/client';
import type { SwapVerificationResult as VerificationResult } from '@/lib/swapVerification';
import {
  SWAP_SIGNATURE_ACTION_LABELS,
  SWAP_SIGNER_ROLE_LABELS,
  type SwapSignatureAction,
  type SwapSignerRole,
} from '@/lib/swapSignatureText';

const formatDateOnly = (value?: string) => {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  return format(new Date(y, m - 1, d), 'dd/MM/yyyy');
};

/**
 * Confere o código no banco (verify_swap_document) e mostra o resultado.
 * Usado na página pública /verificar e no diálogo de verificação da tela de trocas do coordenador.
 */
export function SwapVerificationResult({ code }: { code: string }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setResult(null);
    supabase
      .rpc('verify_swap_document', { p_code: code })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[SwapVerificationResult]', error);
          setFailed(true);
        } else {
          setResult(data as unknown as VerificationResult);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) return <p className="text-center text-sm text-muted-foreground">Verificando…</p>;

  if (failed) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="pt-6 flex gap-3">
          <XCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm">Não foi possível verificar agora. Tente novamente em instantes.</p>
        </CardContent>
      </Card>
    );
  }

  if (!result?.found) {
    return (
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
    );
  }

  return (
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
          Código {result.code}. Por privacidade, esta verificação mostra apenas o primeiro nome e a inicial do sobrenome.
        </p>
      </CardContent>
    </Card>
  );
}
