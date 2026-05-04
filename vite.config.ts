import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

const getAppVersion = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/DiceMaster-battle-simulator/' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(getAppVersion()),
  },
  plugins: [react()],
})
