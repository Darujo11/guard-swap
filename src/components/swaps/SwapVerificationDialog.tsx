import { useEffect, useState } from 'react';
import { ExternalLink, Search, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SwapVerificationResult } from '@/components/swaps/SwapVerificationResult';
import { isCompleteVerificationCode, normalizeVerificationCode } from '@/lib/swapVerification';

interface SwapVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Código já conhecido (botão "Verificar" de uma troca): abre direto com o resultado. */
  initialCode?: string | null;
}

/** Verificação de comprovante dentro do app, sem sair da tela de trocas. */
export function SwapVerificationDialog({ open, onOpenChange, initialCode }: SwapVerificationDialogProps) {
  const [input, setInput] = useState('');
  const [checkedCode, setCheckedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const code = initialCode ? normalizeVerificationCode(initialCode) : '';
    setInput(code);
    setCheckedCode(isCompleteVerificationCode(code) ? code : null);
  }, [open, initialCode]);

  const code = normalizeVerificationCode(input);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompleteVerificationCode(code)) setCheckedCode(code);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verificar comprovante de troca
          </DialogTitle>
          <DialogDescription>
            Digite o código impresso no comprovante ou cole o link de verificação para conferir as assinaturas eletrônicas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="codigo-verificacao">Código de verificação</Label>
            <Input
              id="codigo-verificacao"
              value={input}
              onChange={(e) => setInput(normalizeVerificationCode(e.target.value))}
              placeholder="XXXXX-XXXXX"
              className="font-mono tracking-wider uppercase"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={!isCompleteVerificationCode(code)}>
            <Search className="h-4 w-4 mr-2" />
            Verificar
          </Button>
        </form>

        {checkedCode && (
          <div className="space-y-3">
            <SwapVerificationResult code={checkedCode} />
            <div className="flex justify-end">
              <Button variant="link" size="sm" className="h-auto p-0 gap-1" asChild>
                <a href={`#/verificar/${checkedCode}`} target="_blank" rel="noopener noreferrer">
                  Abrir página pública de verificação
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
