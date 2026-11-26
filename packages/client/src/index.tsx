import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { routes } from './router/config.js';
import './index.css';
import 'json-bigint-patch';
import { SessionExpiryDialog } from './components/session-expiry-dialog.js';
import { FirebaseAuthProvider } from './lib/firebase-auth.js';
import { reloadOnStaleChunk } from './lib/reload-on-stale-chunk.js';
import { FirebaseUrqlTokenBridge } from './providers/firebase-token-bridge.js';
import { setUrqlAccessTokenProvider } from './providers/urql.js';

reloadOnStaleChunk();

const rootElement = document.getElementById('root');
const root = createRoot(rootElement!);
const isDevAuthEnabled = import.meta.env.VITE_DEV_AUTH === '1';

// Create router with object-based configuration
const router = createBrowserRouter(routes);

function DevAuthApp() {
  // Dev auth mode does not require token provider wiring.
  setUrqlAccessTokenProvider(null);
  return <RouterProvider router={router} />;
}

root.render(
  <StrictMode>
    {isDevAuthEnabled ? (
      <DevAuthApp />
    ) : (
      <FirebaseAuthProvider>
        <FirebaseUrqlTokenBridge>
          <RouterProvider router={router} />
          <SessionExpiryDialog />
        </FirebaseUrqlTokenBridge>
      </FirebaseAuthProvider>
    )}
  </StrictMode>,
);
