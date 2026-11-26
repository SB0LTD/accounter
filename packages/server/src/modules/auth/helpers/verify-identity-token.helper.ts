import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Environment } from '../../../shared/types/index.js';

/** Google's keys for Firebase Authentication ID tokens. */
const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// One key set per URL for the process, so keys are fetched once and refreshed by jose as needed.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function keySet(url: string) {
  let keys = jwksCache.get(url);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, keys);
  }
  return keys;
}

/** Whether the server can verify user sign-ins: Firebase Authentication or Auth0. */
export function identityProviderConfigured(env: Environment): boolean {
  return Boolean(env.firebaseAuth || env.auth0);
}

/**
 * Verifies a bearer token from the web client and returns its claims. `sub` is the user's id at the
 * identity provider (Firebase uid, or Auth0 user id), the value stored in
 * `business_users.auth0_user_id`. Throws when the token is not valid.
 */
export async function verifyIdentityToken(env: Environment, token: string): Promise<JWTPayload> {
  if (env.firebaseAuth) {
    const { projectId } = env.firebaseAuth;
    const { payload } = await jwtVerify(token, keySet(FIREBASE_JWKS_URL), {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    // Firebase's own rules for ID tokens beyond the signature: a uid, and a sign-in in the past.
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Firebase ID token without a uid');
    }
    const authTime = payload['auth_time'];
    if (typeof authTime !== 'number' || authTime * 1000 > Date.now() + 60_000) {
      throw new Error('Firebase ID token with an invalid auth_time');
    }
    return payload;
  }
  if (env.auth0) {
    const { domain, audience } = env.auth0;
    const { payload } = await jwtVerify(token, keySet(`https://${domain}/.well-known/jwks.json`), {
      issuer: `https://${domain}/`,
      audience,
    });
    return payload;
  }
  throw new Error('No identity provider is configured (FIREBASE_AUTH_PROJECT_ID or AUTH0_*)');
}
