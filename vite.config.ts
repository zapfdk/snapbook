import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * GitHub Pages cannot set response headers, so a Content-Security-Policy has to
 * live in the document itself.
 *
 * It is injected into the built page rather than written into index.html
 * because `vite dev` needs an inline preamble script and a WebSocket for its
 * HMR client, and this policy allows neither. Development therefore runs
 * without a policy, and the deployed build enforces one.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // React writes colours into style attributes, which the CSP treats as inline
  // styles; there is no way to allow attributes without allowing inline CSS.
  "style-src 'self' 'unsafe-inline'",
  // data: for the icon sprite and generated images, blob: for exported files.
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // Dropbox is the only service the app talks to itself.
  "connect-src 'self' https://api.dropboxapi.com https://content.dropboxapi.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'snapbook-content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

export default defineConfig({
  // Relative asset paths keep the build working on GitHub Pages project URLs
  // (https://<user>.github.io/<repo>/) as well as on a custom domain.
  base: './',
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  build: {
    // Vite inlines assets under 4 kB, which turns the smallest font subset into
    // a data: URI. Keeping fonts as files lets the policy stay at font-src
    // 'self' instead of allowing data: there for one 1.6 kB file.
    assetsInlineLimit: (filePath) => (filePath.endsWith('.woff2') ? false : undefined),
  },
})
