/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: 'protodocs-config-mode',
      configureServer(server) {
        if (mode !== 'desktop') return;
        server.middlewares.use('/config.yaml', (_req, res) => {
          const configPath = path.resolve(__dirname, 'public/config.desktop.yaml');
          res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
          res.end(fs.readFileSync(configPath));
        });
      },
    },
    tailwindcss(),
    react(),
  ],
  base: './',
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
    environment: 'node',
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
}))
