import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import './index.css'

// Handle GitHub Pages SPA redirect
const redirectPath = sessionStorage.getItem('redirect')
if (redirectPath) {
  sessionStorage.removeItem('redirect')
  // Navigate to the stored path after the app loads
  window.history.replaceState(null, '', redirectPath)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
