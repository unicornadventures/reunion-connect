import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Maps the '@' character directly to your frontend 'src' folder
      '@': path.resolve(__dirname, './src'), 
    },
  },
  build: {
    outDir: 'dist', 
    sourcemap: true,
  },
});