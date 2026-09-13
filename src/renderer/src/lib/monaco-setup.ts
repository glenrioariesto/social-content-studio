import { loader } from '@monaco-editor/react'

/**
 * Monaco must run fully offline (no CDN) and inside a strict CSP.
 *
 * Strategy: use the AMD loader with locally-bundled monaco assets (copied to
 * public/vs at build time). This avoids bundling monaco through Vite, which
 * would pull in the entire editor (~8MB) plus every language worker and hang
 * the build. Instead, monaco is loaded at runtime from same-origin static
 * files, keeping the renderer bundle small and the build fast.
 *
 * The AMD loader requires 'unsafe-eval' in CSP (see index.html). This is
 * acceptable for a local-first Electron desktop app where all code is loaded
 * from disk, not the network.
 */
loader.config({
  paths: {
    vs: '/vs'
  }
})

self.MonacoEnvironment = {
  getWorker: (_workerId: string, label: string): Worker => {
    if (label === 'json') return new Worker('/vs/language/json/json.worker.js')
    if (label === 'css' || label === 'scss' || label === 'less') return new Worker('/vs/language/css/css.worker.js')
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new Worker('/vs/language/html/html.worker.js')
    if (label === 'typescript' || label === 'javascript') return new Worker('/vs/language/typescript/ts.worker.js')
    return new Worker('/vs/editor/editor.worker.js')
  }
}