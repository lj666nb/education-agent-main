import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const proxyTarget = process.env.VITE_API_PROXY || 'http://localhost:8000'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['echarts', 'echarts-for-react', 'reactflow'],
          'editor-vendor': ['@monaco-editor/react', 'monaco-editor'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/swagger': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/redoc-doc': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/health': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/static': {
        target: proxyTarget,
        changeOrigin: true,
      },
      '/docs': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
})
