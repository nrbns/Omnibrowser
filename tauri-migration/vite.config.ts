import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  optimizeDeps: {
    exclude: ['@sentry/electron/renderer', 'pdf-parse'], // Sentry is optional, pdf-parse is Node.js only
  },
  build: {
    // Production optimizations (Day 7)
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV !== 'production', // Disable source maps in production
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['framer-motion', 'lucide-react'],
          'chart-vendor': ['lightweight-charts'],
        },
      },
      external: id => {
        // Make Sentry optional - don't fail build if not installed
        if (id.includes('@sentry/electron/renderer')) {
          return false; // Still bundle, but handle gracefully
        }
        // pdf-parse is Node.js only, mark as external for Tauri
        if (id === 'pdf-parse' || id.includes('pdf-parse')) {
          return false; // Bundle it, but it will only work in Tauri/Node context
        }
        return false;
      },
    },
    // Target modern browsers for smaller bundles
    target: 'esnext',
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Allow external connections
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
