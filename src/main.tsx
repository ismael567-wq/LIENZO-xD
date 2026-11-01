import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/inter';
import '@fontsource/instrument-serif';
import './styles/global.css';
import App from './App';

registerSW({ immediate: true });

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el contenedor de la aplicación.');

createRoot(container).render(<App />);
