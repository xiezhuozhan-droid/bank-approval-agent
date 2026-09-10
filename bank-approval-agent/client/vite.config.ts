import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 开发时浏览器直连 Vite dev server;API 请求走 server 的 8787 端口(CORS 已在后端放行)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
