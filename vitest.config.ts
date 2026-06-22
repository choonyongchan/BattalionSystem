import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    environmentMatchGlobs: [
      ['tests/unit/**', 'node'],
    ],
    // Integration tests share a real Supabase DB — run files sequentially to
    // avoid seed/truncate race conditions between parallel test files
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
