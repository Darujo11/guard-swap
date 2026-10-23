import { describe, expect, it } from 'vitest';
import { escapeHtml, PRINT_DOCUMENT_CSP_META } from './html';

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
  it('bloqueia scripts (default-src none) e libera só o CSS embutido', () => {
    expect(PRINT_DOCUMENT_CSP_META).toContain("default-src 'none'");
    expect(PRINT_DOCUMENT_CSP_META).toContain("style-src 'unsafe-inline'");
    expect(PRINT_DOCUMENT_CSP_META).not.toContain('script-src');
  });
});
