/**
 * Escapa texto para ser interpolado em HTML montado como string (ex.: comprovantes impressos via
 * `window.open` + `document.write`). Sem isso, um "motivo" como `<img src=x onerror=...>` vira código
 * rodando na janela de impressão, que tem a mesma origem do app e acesso à sessão de quem imprime.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * CSP para documentos de impressão: só permite o CSS embutido. Segunda barreira caso algum campo
 * novo seja interpolado sem `escapeHtml` — nenhum script, imagem externa ou requisição é carregado.
 * Deve ser o primeiro elemento do <head>.
 */
export const PRINT_DOCUMENT_CSP_META =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`;
