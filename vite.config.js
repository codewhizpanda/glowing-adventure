import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/khonsu-tech-ops/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // we supply our own manifest.json in public/
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
});
