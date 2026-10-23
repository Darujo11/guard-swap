import logoUrl from '@/assets/logo-camara-documento.png';
import type { SwapRequest } from '@/lib/types';
import { buildSwapReceiptHtml } from '@/utils/swapReceipt';

// A CSP do documento impresso só aceita imagem embutida (data:), então a logo é lida uma vez e
// convertida. Se falhar (offline sem cache, por ex.), o comprovante sai com o nome em texto.
let logoDataUrlPromise: Promise<string | null> | null = null;

function loadLogoDataUrl(): Promise<string | null> {
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

/**
 * Abre o comprovante da troca numa janela e chama a impressão (o usuário escolhe "Salvar como PDF").
 * Chamar direto no clique: a janela é aberta antes de qualquer await para não cair no bloqueador de
 * pop-up. Retorna false se o navegador bloqueou a janela.
 */
export async function printSwapReceipt(request: SwapRequest): Promise<boolean> {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;

  const logoDataUrl = await loadLogoDataUrl();

  printWindow.document.open();
  printWindow.document.write(buildSwapReceiptHtml(request, { logoDataUrl }));
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
