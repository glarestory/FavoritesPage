import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiTarget = env.API_PROXY_TARGET || 'http://127.0.0.1:8787'

  return {
    // GitHub Pages serves the app from /<repo>/, so CI sets BASE_PATH.
    base: env.BASE_PATH || '/',
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: false,
        },
      },
    },
  }
})
