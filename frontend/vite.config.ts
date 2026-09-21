import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Em desenvolvimento o backend roda separado; em producao o nginx
    // do container do frontend faz o mesmo encaminhamento.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // 127.0.0.1 e nao localhost: no Windows, localhost pode resolver para IPv6 primeiro
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // A pagina publica e aberta no celular, muitas vezes em rede movel:
        // separar os graficos evita baixa-los em quem so vai doar.
        manualChunks: {
          graficos: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
