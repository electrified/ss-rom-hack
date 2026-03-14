import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, copyFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-chiptune-worklets',
      writeBundle(options) {
        const assetsDir = resolve(options.dir ?? 'dist', 'assets');
        mkdirSync(assetsDir, { recursive: true });
        for (const file of ['chiptune3.worklet.js', 'libopenmpt.worklet.js']) {
          copyFileSync(
            resolve('node_modules/chiptune3', file),
            resolve(assetsDir, file),
          );
        }
      },
    },
  ],
  base: '/sensi/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  optimizeDeps: {
    exclude: ['chiptune3'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
