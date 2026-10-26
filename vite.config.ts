import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  return {
    // GitHub Pages serves the app from /<repo>/, so CI sets BASE_PATH.
    base: env.BASE_PATH || '/',
    plugins: [react()],
  }
})
