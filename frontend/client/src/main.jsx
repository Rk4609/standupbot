import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted so the PWA keeps its typography offline and there is no
// render-blocking round trip to a font CDN. Latin subset only.
// `wght` is the weight-axis build; the 7 subset faces carry unicode-range so a
// browser only downloads the ones the page actually needs (latin, here).
import '@fontsource-variable/inter/wght.css'

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
