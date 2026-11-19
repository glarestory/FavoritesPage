import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const isExtension = mode === 'extension'

  return {
    // GitHub Pages는 /<repo>/ 경로로 배포되고, Chrome 확장은 상대 경로(./)를 사용합니다.
    base: isExtension ? './' : env.BASE_PATH || '/',
    build: {
      outDir: isExtension ? 'dist-extension' : 'dist',
      emptyOutDir: true,
    },
    plugins: [react()],
  }
})
