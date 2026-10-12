import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // relative paths: works on GitHub Pages subpaths and inside Capacitor
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate', // a new version is picked up on the next launch, never mid-session
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Idle Realm',
        short_name: 'Idle Realm',
        description: 'A skilling idle game: chop, mine, fish, smith and cook.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#14161c',
        theme_color: '#14161c',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
