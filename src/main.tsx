import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './auth.tsx';
import './styles.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});

  // The app opens from its cached copy; a newer version, once downloaded, is
  // switched to when you come back after a while, never in the middle of a set.
  const RELOAD_AFTER_AWAY_MS = 10 * 60_000;
  let updateReady = false;
  let hiddenAt = 0;
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'updated') updateReady = true;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (updateReady && Date.now() - hiddenAt > RELOAD_AFTER_AWAY_MS) location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
