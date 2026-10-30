import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { I18n } from './i18n';
import { ToastProvider } from './ui';
import './styles.css';

// Prevent unwanted browser auto-install popups
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  return false;
});

createRoot(document.getElementById('root')).render(<HashRouter><AuthProvider><I18n><ToastProvider><App /></ToastProvider></I18n></AuthProvider></HashRouter>);
