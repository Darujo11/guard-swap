import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SwapVerificationResult } from '@/components/swaps/SwapVerificationResult';
import { isCompleteVerificationCode, normalizeVerificationCode } from '@/lib/swapVerification';
import logoCamara from '@/assets/logo-camara-documento.png';

export default function VerifySwap() {
  const { code: codeParam } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [input, setInput] = useState(codeParam ? normalizeVerificationCode(codeParam) : '');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeVerificationCode(input);
    if (isCompleteVerificationCode(code)) navigate(`/verificar/${code}`);
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
                  onChange={(e) => setInput(normalizeVerificationCode(e.target.value))}
                  placeholder="XXXXX-XXXXX"
                  className="font-mono tracking-wider uppercase"
                  autoComplete="off"
                  inputMode="text"
                />
              </div>
              <Button type="submit" disabled={!isCompleteVerificationCode(normalizeVerificationCode(input))}>
                <Search className="h-4 w-4 mr-2" />
                Verificar
              </Button>
            </form>
          </CardContent>
        </Card>

        {codeParam && <SwapVerificationResult code={codeParam} />}
      </div>
    </div>
  );
}
