import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { AuthProvider } from './state/auth'
import { ToastProvider } from './ui/toast'
import { I18nProvider } from './state/i18n'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>
)
