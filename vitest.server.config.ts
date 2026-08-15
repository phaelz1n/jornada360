import { defineConfig } from 'vitest/config';

/* Testes do backend: rodam em Node (não jsdom) e exercitam as rotas reais via HTTP contra o app
 * montado em memória. Config separada da do frontend porque o ambiente e o alvo são diferentes. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.js'],
    /* Um arquivo por vez: os testes compartilham um banco SQLite em disco, e execução paralela
     * geraria contenção de escrita sem nenhum ganho real neste volume. */
    fileParallelism: false,
  },
});
