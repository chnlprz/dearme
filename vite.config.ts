import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'icons/*.svg', 'icons/*.png', 'fonts/*.woff2'],
      manifest: {
        name: 'Dear Me,',
        short_name: 'Dear Me,',
        description: 'A jar of kept promises to yourself.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#1a0a2a',
        theme_color: '#341556',
        icons: [
          { src: '/icons/app-icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: '/icons/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        importScripts: ['push-sw.js'], // evening reminders (Web Push)
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/og-image.png'],
      },
    }),
  ],
});
