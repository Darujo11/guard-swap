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
 * Devolve `raw` normalizada só se for uma URL https dentro de `allowedPrefix` (mesma origem e caminho
 * começando pelo prefixo); senão `null`. Para links gravados no banco que o app abre com
 * `window.open`: barra `javascript:`/`data:` (que rodariam código na origem do app) e links para
 * sites de fora. `new URL` já resolve `..` e `%2e%2e`, então não dá para escapar do prefixo.
 */
export function getSafeUrlWithPrefix(raw: unknown, allowedPrefix: string): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;

  let url: URL;
  let prefix: URL;
  try {
    url = new URL(raw.trim());
    prefix = new URL(allowedPrefix);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' || url.origin !== prefix.origin) return null;
  if (!url.pathname.startsWith(prefix.pathname)) return null;

  return url.href;
}

/**
 * CSP para documentos de impressão: só permite o CSS embutido e imagens embutidas (data:, ex. a logo).
 * Segunda barreira caso algum campo novo seja interpolado sem `escapeHtml` — nenhum script, imagem
 * externa ou requisição é carregado.
 * Deve ser o primeiro elemento do <head>.
 */
export const PRINT_DOCUMENT_CSP_META =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`;
