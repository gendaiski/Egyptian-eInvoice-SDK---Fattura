import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { ROUTER_MODE, initialPathFromHash } from './env';
import { I18nProvider } from './i18n';
import { StoreProvider } from './store/store';
import { ToastProvider } from './components/ui';
import './styles/index.css';

function Router({ children }: { children: ReactNode }) {
  return ROUTER_MODE === 'memory'
    ? <MemoryRouter initialEntries={[initialPathFromHash()]}>{children}</MemoryRouter>
    : <BrowserRouter>{children}</BrowserRouter>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <I18nProvider>
        <StoreProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </StoreProvider>
      </I18nProvider>
    </Router>
  </StrictMode>,
);
