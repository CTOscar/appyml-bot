import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { BotApp } from './BotApp.jsx';
import { initBotTheme } from '../theme/theme.js';

initBotTheme();
createRoot(document.getElementById('root')).render(<StrictMode><BotApp /></StrictMode>);
