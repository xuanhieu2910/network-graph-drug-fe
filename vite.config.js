import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only same-origin proxy for HPO. Other existing API clients remain unchanged.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.KG_FASTAPI_PROXY_TARGET || env.VITE_API_BASE_URL || env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/__kg_backend': {
          target,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/__kg_backend/, ''),
        },
      },
    },
  };
});
