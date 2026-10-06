import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/press-start-2p/400.css'
import { createAnalytics } from './analytics'

const initAnalytics = createAnalytics(import.meta.env.VITE_GA_MEASUREMENT_ID?.trim());
initAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
