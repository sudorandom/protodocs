/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    proxy: process.env.PROXY_TARGET ? {
      '/api': {
        target: process.env.PROXY_TARGET,
        changeOrigin: true,
      },
    } : undefined,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/@bufbuild/protobuf')) return 'vendor-buf';
          if (id.includes('node_modules/react-markdown') || id.includes('node_modules/remark-gfm')) return 'vendor-markdown';
          return undefined;
        }
      }
    }
  }
})

