import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      // Forward API calls to the Deno server during development.
      '/api': 'http://localhost:1234',
    },
  },
})
