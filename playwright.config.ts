import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.test' })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      NEXT_PUBLIC_STALLION_SUPABASE_URL: process.env.TEST_SUPABASE_URL ?? '',
      NEXT_PUBLIC_STALLION_SUPABASE_PUBLISHABLE_KEY: process.env.TEST_SUPABASE_ANON_KEY ?? '',
    },
  },
})
