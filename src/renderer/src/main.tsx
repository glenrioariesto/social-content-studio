import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './lib/monaco-setup'
import { App } from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ErrorToastContainer } from './components/ErrorToastContainer'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <App />
        <ErrorToastContainer />
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>
)
