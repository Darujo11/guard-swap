import logoUrl from '@/assets/logo-camara-documento.png';
import { supabase } from '@/integrations/supabase/client';
import type { SwapRequest } from '@/lib/types';
import { buildSwapReceiptHtml, type ReceiptSignature } from '@/utils/swapReceipt';

// A CSP do documento impresso só aceita imagem embutida (data:), então a logo é lida uma vez e
// convertida. Se falhar (offline sem cache, por ex.), o documento sai com o nome em texto.
// Usada também pelo relatório mensal de trocas.
let logoDataUrlPromise: Promise<string | null> | null = null;

export function loadLogoDataUrl(): Promise<string | null> {
  logoDataUrlPromise ??= fetch(logoUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        })
    )
    .catch((error) => {
      console.error('[printSwapReceipt] Logo indisponível:', error);
      logoDataUrlPromise = null;
      return null;
    });
  return logoDataUrlPromise;
}

// Assinaturas eletrônicas da troca (swap_signatures). Falha vira lista vazia: o comprovante sai com
// linhas para assinatura manual, como nas trocas anteriores à assinatura eletrônica.
async function loadSignatures(swapId: string): Promise<ReceiptSignature[]> {
  const { data, error } = await supabase
    .from('swap_signatures')
    .select('action, signer_role, signer_name, signed_at, verification_code, ip')
    .eq('swap_id', swapId)
    .order('signed_at', { ascending: true });

  if (error) {
    console.error('[printSwapReceipt] Assinaturas indisponíveis:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Abre o comprovante da troca numa janela e chama a impressão (o usuário escolhe "Salvar como PDF").
 * Chamar direto no clique: a janela é aberta antes de qualquer await para não cair no bloqueador de
 * pop-up. Retorna false se o navegador bloqueou a janela.
 */
export async function printSwapReceipt(request: SwapRequest): Promise<boolean> {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const [logoDataUrl, signatures] = await Promise.all([loadLogoDataUrl(), loadSignatures(request.id)]);

  printWindow.document.open();
  printWindow.document.write(
    buildSwapReceiptHtml(request, {
      logoDataUrl,
      signatures,
      verifyBaseUrl: `${window.location.origin}/#/verificar/`,
    })
  );
  printWindow.document.close();

  // O documento impresso não roda script (CSP), então quem espera a logo ficar pronta é esta função;
  // sem isso a impressão pode sair antes da imagem.
  await Promise.all(
    Array.from(printWindow.document.images).map((img) => img.decode().catch(() => undefined))
  );

  printWindow.focus();
  printWindow.print();
  return true;
}
