import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  base: './', // relative paths: works on GitHub Pages subpaths and inside Capacitor
  plugins: [preact()],
})
