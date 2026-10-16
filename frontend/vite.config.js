import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'page-version',
    transformIndexHtml(html) {
      return html.replaceAll('%APP_VERSION%', version);
    },
  }],
  base: '/sensi/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,jsx}'],
  },
})
