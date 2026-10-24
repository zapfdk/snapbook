import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative asset paths keep the build working on GitHub Pages project URLs
  // (https://<user>.github.io/<repo>/) as well as on a custom domain.
  base: './',
  plugins: [react(), tailwindcss()],
})
