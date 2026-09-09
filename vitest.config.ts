import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/* Testes do Jornada360.
 *
 * Estratégia deliberada: cobrir REGRA DE NEGÓCIO, não interface. Os services são funções puras
 * sobre estruturas de dados — testá-los dá proteção real contra regressão a um custo baixo.
 * Testar renderização de componente daria números de cobertura maiores com muito menos proteção:
 * um teste que verifica se um `<div>` apareceu não impede que a regra de tolerância mude sozinha.
 *
 * FASE 4 — acrescentados testes de INTERFACE, e só para os fluxos que a regra de negócio não
 * consegue proteger sozinha: login, guarda de rota, empresa ativa, carregamento, erro de rede,
 * sessão expirada e acesso negado. São caminhos onde o defeito não é um número errado, é a pessoa
 * ver o que não deveria — ou não conseguir entrar. Não se persegue cobertura visual: um teste que
 * confere se um `<div>` apareceu não impede a regra de tolerância de mudar sozinha.
 *
 * `environment: 'jsdom'` cobre tanto os testes que tocam `localStorage` quanto os de componente. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/services/**', 'src/engine/**', 'src/repositories/**', 'src/domain/**'],
      exclude: ['**/*.test.ts', 'src/**/index.ts'],
    },
  },
});
