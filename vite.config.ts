import { defineConfig } from '@octohash/vite-config'

export default defineConfig({
  vite: { base: './', build: { target: 'es2022' } },
  vue: {
    i18n: true,
    pages: false,
  },
})
