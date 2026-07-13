import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const proxyTarget = process.env.VITE_API_PROXY || 'http://localhost:8000'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react({
      // Use automatic JSX runtime for smaller bundles
      jsxRuntime: 'automatic',
      // Babel plugins for production optimizations
      babel: {
        plugins: [],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Pre-bundle heavy dependencies for faster dev and optimized production
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'axios',
      'lucide-react',
      'd3',
      'echarts',
      'mammoth',     // dynamically imported in ChatPlatform for docx preview
    ],
    exclude: ['monaco-editor'],
  },
  build: {
    target: 'es2020',
    cssMinify: 'lightningcss',
    minify: 'terser',
    reportCompressedSize: false,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
      },
      output: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        // Hashed filenames for long-term caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          // Only split the biggest dependencies to avoid circular chunks
          if (!id.includes('node_modules')) return
          // Monaco editor (~15MB) — heaviest dependency, always separate
          if (id.includes('/monaco-editor/') || id.includes('/@monaco-editor/')) return 'monaco'
          // Mermaid (~3MB)
          if (id.includes('/mermaid/')) return 'mermaid'
          // ECharts (~1MB)
          if (id.includes('/echarts/') || id.includes('/zrender/')) return 'echarts'
          // Markmap (~1MB)
          if (id.includes('/markmap-')) return 'markmap'
          // Tiptap (~500KB)
          if (id.includes('/@tiptap/')) return 'tiptap'
          // D3 (~500KB)
          if (id.includes('/d3-') || id.includes('/delaunator/') || id.includes('/robust-predicates/')) return 'd3'
          // Syntax highlighting (~1MB)
          if (id.includes('/react-syntax-highlighter/') || id.includes('/refractor/') || id.includes('/highlight.js/')) return 'syntax'
          // PDF libs (~500KB)
          if (id.includes('/jspdf/') || id.includes('/html2canvas/')) return 'pdf'
          // React ecosystem → single chunk for shared deps
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router/') || id.includes('/scheduler/')) return 'react-vendor'
          // Lucide icons → separate to avoid bloating vendor
          if (id.includes('/lucide-react/')) return 'lucide'
        },
      },
    },
    chunkSizeWarningLimit: 800,
    assetsInlineLimit: 8192,
    sourcemap: false,
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
})
