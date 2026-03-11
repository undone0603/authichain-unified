import { defineConfig } from 'vite';
import cloudflare from 'vite-plugin-cloudflare';

export default defineConfig({
  plugins: [cloudflare()],
  build: {
    target: 'es2022',
    minify: true,
    rollupOptions: {
      output: {
        format: 'esm',
      },
    },
  },
});
