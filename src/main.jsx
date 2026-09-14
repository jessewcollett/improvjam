import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import StageView from './components/StageView.jsx';
import IdeasView from './components/IdeasView.jsx';
import { applyTheme, readStoredTheme } from './lib/theme.js';
import './index.css';

const path = window.location.pathname.replace(/\/+$/, '');
const isStage = path === '/stage';
const isIdeas = path === '/ideas';
applyTheme(isStage || isIdeas ? 'dark' : readStoredTheme());

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isStage ? <StageView /> : isIdeas ? <IdeasView /> : <App />}
  </StrictMode>,
);
