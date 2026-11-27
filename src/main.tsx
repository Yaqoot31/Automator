import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { FirebaseErrorBoundary } from '@/components/FirebaseErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <FirebaseErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </FirebaseErrorBoundary>,
)
