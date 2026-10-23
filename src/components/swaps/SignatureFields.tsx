import { ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { SWAP_SIGNATURE_DECLARATIONS, type SwapSignatureAction } from '@/lib/swapSignature';

interface SignatureFieldsProps {
  action: SwapSignatureAction;
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  disabled?: boolean;
  /** Prefixo dos ids, para mais de um bloco na mesma tela. */
  idPrefix?: string;
}

export function SignatureFields({
  action,
  agreed,
  onAgreedChange,
  password,
  onPasswordChange,
  disabled,
  idPrefix = 'assinatura',
}: SignatureFieldsProps) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <ShieldCheck className="h-4 w-4" />
        Assinatura eletrônica
      </div>

      <div className="flex items-start gap-3">
        <Checkbox
          id={`${idPrefix}-declaracao`}
          checked={agreed}
          onCheckedChange={(value) => onAgreedChange(value === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <Label htmlFor={`${idPrefix}-declaracao`} className="text-sm font-normal leading-snug cursor-pointer">
          {SWAP_SIGNATURE_DECLARATIONS[action]}
        </Label>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-senha`} className="text-sm">
          Confirme com sua senha
        </Label>
        <PasswordInput
          id={`${idPrefix}-senha`}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          autoComplete="current-password"
          placeholder="Sua senha de acesso"
          disabled={disabled}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Ficam registrados seu nome, data e hora, IP e navegador, junto com os termos da troca.
      </p>
    </div>
  );
}
