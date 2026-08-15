import { defineConfig } from 'vitest/config';
import path from 'path';

// Config própria para testes: não carrega o plugin de PWA nem o de React,
// que não fazem sentido fora do build e só encareceriam a suíte.
export default defineConfig({
  test: {
    // As regras testadas são puras (sem DOM), então `node` basta e é mais rápido.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    reporters: 'default',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
