import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: {baseURL: 'http://127.0.0.1:5175/sensi/', headless: true,
    launchOptions: process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}},
  webServer: {command: 'npm run preview -- --host 127.0.0.1 --port 5175 --strictPort', url: 'http://127.0.0.1:5175/sensi/', reuseExistingServer: false},
});
