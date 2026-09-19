import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/press-start-2p/400.css'
import './index.css'
import { initCookieConsent } from './cookieConsent'

initCookieConsent();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
