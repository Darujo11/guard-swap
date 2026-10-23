import { useCallback, useState } from 'react';

/** Estado dos campos de assinatura de um diálogo. `reset` ao abrir/fechar para não reaproveitar a senha. */
export function useSignatureFields() {
  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState('');
  const reset = useCallback(() => {
    setAgreed(false);
    setPassword('');
  }, []);
  return { agreed, setAgreed, password, setPassword, reset, ready: agreed && password.length > 0 };
}
