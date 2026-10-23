import { describe, expect, it } from 'vitest';
import { escapeHtml, getSafeUrlWithPrefix, PRINT_DOCUMENT_CSP_META } from './html';

const PREFIX = 'https://wyoysecfbmmidjiofymg.supabase.co/storage/v1/object/public/leave-documents/';

describe('getSafeUrlWithPrefix', () => {
  it('aceita o link público gerado pelo upload do documento', () => {
    const url = `${PREFIX}0b1c2d3e-0000-4000-8000-000000000000/1761230000000.pdf`;
    expect(getSafeUrlWithPrefix(url, PREFIX)).toBe(url);
  });

  it('bloqueia javascript: e data:, que rodariam código na origem do app', () => {
    expect(getSafeUrlWithPrefix('javascript:alert(document.cookie)', PREFIX)).toBeNull();
    expect(getSafeUrlWithPrefix(' JavaScript:alert(1)', PREFIX)).toBeNull();
    expect(getSafeUrlWithPrefix('data:text/html,<script>alert(1)</script>', PREFIX)).toBeNull();
  });

  it('bloqueia sites de fora, http e outros buckets do mesmo projeto', () => {
    expect(getSafeUrlWithPrefix('https://evil.example/leave-documents/x.pdf', PREFIX)).toBeNull();
    expect(getSafeUrlWithPrefix(PREFIX.replace('https:', 'http:') + 'x.pdf', PREFIX)).toBeNull();
    expect(
      getSafeUrlWithPrefix('https://wyoysecfbmmidjiofymg.supabase.co/storage/v1/object/public/guard-photos/x.png', PREFIX)
    ).toBeNull();
  });

  it('não deixa sair do prefixo com .. (nem codificado)', () => {
    expect(getSafeUrlWithPrefix(`${PREFIX}../guard-photos/x.png`, PREFIX)).toBeNull();
    expect(getSafeUrlWithPrefix(`${PREFIX}%2e%2e/guard-photos/x.png`, PREFIX)).toBeNull();
  });

  it('bloqueia domínio parecido que começa com o mesmo texto', () => {
    expect(
      getSafeUrlWithPrefix('https://wyoysecfbmmidjiofymg.supabase.co.evil.example/storage/v1/object/public/leave-documents/x.pdf', PREFIX)
    ).toBeNull();
  });

  it('trata vazio, null e não-texto como inválido', () => {
    expect(getSafeUrlWithPrefix('', PREFIX)).toBeNull();
    expect(getSafeUrlWithPrefix(null, PREFIX)).toBeNull();
    expect(getSafeUrlWithPrefix(123, PREFIX)).toBeNull();
    expect(getSafeUrlWithPrefix('not a url', PREFIX)).toBeNull();
  });
});

describe('escapeHtml', () => {
  it('neutraliza tags e handlers que um segurança poderia escrever no motivo da troca', () => {
    expect(escapeHtml('<img src=x onerror="fetch(\'//evil\')">')).toBe(
      '&lt;img src=x onerror=&quot;fetch(&#39;//evil&#39;)&quot;&gt;'
    );
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapa & primeiro para não gerar entidades duplas', () => {
    expect(escapeHtml('a & b &lt;')).toBe('a &amp; b &amp;lt;');
  });

  it('mantém texto comum, acentos e emojis intactos', () => {
    expect(escapeHtml('Consulta médica às 14h ✅')).toBe('Consulta médica às 14h ✅');
  });

  it('trata null/undefined como vazio em vez de imprimir "undefined"', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
  });

  it('converte números e outros valores para texto', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('PRINT_DOCUMENT_CSP_META', () => {
  it('bloqueia scripts (default-src none) e libera só o CSS e imagens embutidos', () => {
    expect(PRINT_DOCUMENT_CSP_META).toContain("default-src 'none'");
    expect(PRINT_DOCUMENT_CSP_META).toContain("style-src 'unsafe-inline'");
    expect(PRINT_DOCUMENT_CSP_META).toContain('img-src data:');
    expect(PRINT_DOCUMENT_CSP_META).not.toContain('script-src');
    expect(PRINT_DOCUMENT_CSP_META).not.toMatch(/img-src[^;"]*(https?:|\*|'self')/);
  });
});
