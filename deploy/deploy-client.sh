#!/usr/bin/env bash
# Builds the Accounter web app against the deployed API and publishes it to Firebase Hosting
# (project sb0-accounter, served at https://acc.sb0.tech). See docs/firestore/deploy.md.
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL=$(gcloud run services describe accounter-api --project sbzero --region me-west1 --format='value(status.url)')

# Firebase web config of the "Accounter" app in project sbzero (public identifiers, not secrets).
export FIREBASE_API_KEY=AIzaSyCHFOV6uApINuyn-9XYPBxMeN6YFhLa8so
export FIREBASE_AUTH_DOMAIN=sbzero.firebaseapp.com
export FIREBASE_PROJECT_ID=sbzero
export FIREBASE_APP_ID=1:678576192331:web:78d595b06bd95d726dc6ce
export GRAPHQL_URL="$API_URL/graphql"

yarn workspace @accounter/client build --mode production

# Hosting serves a folder inside the config's directory: copy the build next to firebase.json.
rm -rf deploy/.build/hosting
mkdir -p deploy/.build
cp -r packages/client/dist deploy/.build/hosting
firebase deploy --only hosting --project sb0-accounter --config deploy/firebase.json
