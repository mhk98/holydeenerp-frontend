import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 5173,
      proxy: {
        // Same-origin API in dev so httpOnly auth cookies just work.
        '/api': { target: env.VITE_API_PROXY_TARGET || 'https://apierp.holydeen.com', changeOrigin: true },
        '/uploads': { target: env.VITE_API_PROXY_TARGET || 'https://apierp.holydeen.com', changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('@radix-ui')) return 'radix';
            if (id.includes('@tanstack')) return 'tanstack';
            if (/react-dom|react-router|[\\/]react[\\/]|scheduler/.test(id)) return 'react';
            return undefined;
          },
        },
      },
    },
  };
});
