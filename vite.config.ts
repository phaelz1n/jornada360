import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/* O proxy de `/api` é o que torna o cookie de sessão possível em desenvolvimento.
 *
 * Sem ele, a página roda em localhost:5173 e a API em localhost:3333 — origens diferentes. Um
 * cookie de sessão nessa situação precisaria de `SameSite=None; Secure`, que exige HTTPS; sem
 * HTTPS o navegador simplesmente descarta o cookie e o login parece "não funcionar".
 *
 * Com o proxy, o navegador enxerga tudo em localhost:5173: o cookie é first-party, `SameSite=Lax`
 * basta, e não é preciso HTTPS para desenvolver. Em produção a mesma topologia se repete (um
 * domínio servindo frontend e API), então o comportamento é o mesmo nos dois ambientes — que é
 * exatamente o que se quer de uma configuração de desenvolvimento.
 *
 * `JORNADA_API_ALVO` permite apontar para uma API em outra porta/máquina sem editar este arquivo. */
const ALVO_API = process.env.JORNADA_API_ALVO || 'http://localhost:3333'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: ALVO_API,
        changeOrigin: false,
      },
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        },
      },
    },
  },
})
