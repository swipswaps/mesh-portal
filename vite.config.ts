import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' => GitHub Pages project site works under any subpath.
// HashRouter (not BrowserRouter) for the same reason: refresh must not 404.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
});
