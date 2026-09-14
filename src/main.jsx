import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import StageView from './components/StageView.jsx';
import { applyTheme, readStoredTheme } from './lib/theme.js';
import './index.css';

const isStage = window.location.pathname.replace(/\/+$/, '') === '/stage';
applyTheme(isStage ? 'dark' : readStoredTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isStage ? <StageView /> : <App />}
  </StrictMode>,
);
