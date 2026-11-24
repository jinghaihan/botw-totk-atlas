import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': decodeURIComponent(new URL('./src', import.meta.url).pathname) } },
  test: { setupFiles: ['./test/setup.ts'], include: ['test/**/*.test.ts'] },
})
