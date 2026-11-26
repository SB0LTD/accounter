/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Firebase web app config (see `src/lib/firebase-auth.tsx`). Absent when unset: sign-in then
  // reports that it is not configured.
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  // Optional: the resolver falls back to a per-MODE default when it is absent,
  // and `build-env.ts` substitutes an empty string when `GRAPHQL_URL` is unset.
  readonly VITE_GRAPHQL_URL?: string;
  readonly VITE_DEV_AUTH?: string;
  readonly VITE_DEV_AUTH_USER_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
