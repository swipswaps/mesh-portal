import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: { viewport: { width: 1280, height: 800 } },
  webServer: {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: true,
  },
});
