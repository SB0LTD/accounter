#!/usr/bin/env bash
# Builds and deploys the Accounter API to Cloud Run (project sbzero, region me-west1), on the
# Firestore engine and Firebase Authentication. See docs/firestore/deploy.md.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=sbzero
REGION=me-west1
SERVICE=accounter-api
FRONTEND_URL=${FRONTEND_URL:-https://acc.sb0.tech}

# Every query must be ported and the index current, or requests would hit "not ported" errors.
yarn workspace @accounter/server firestore:queries --check

yarn workspaces foreach --all --parallel \
  --include @accounter/green-invoice-graphql --include @accounter/opcn1214-generator \
  --include @accounter/pcn874-generator --include @accounter/shaam-uniform-format-generator \
  --include @accounter/shaam6111-generator run build
rm -rf packages/server/dist
yarn workspace @accounter/server build
node deploy/stage-server.mjs

gcloud run deploy "$SERVICE" \
  --project "$PROJECT" --region "$REGION" \
  --source deploy/.build/server \
  --service-account "accounter-api@$PROJECT.iam.gserviceaccount.com" \
  --port 4000 --cpu 1 --memory 1Gi \
  --min-instances 1 --max-instances 1 --concurrency 80 --timeout 300 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,RELEASE=1,ACCOUNTER_DB_ENGINE=firestore,FIRESTORE_PROJECT_ID=$PROJECT,FIRESTORE_DATABASE_ID=accounter,FIREBASE_AUTH_PROJECT_ID=$PROJECT,FRONTEND_URL=$FRONTEND_URL,SERVER_LOG_LEVEL=info" \
  --set-secrets "CREDENTIALS_ENCRYPTION_KEY=accounter-credentials-encryption-key:latest"

gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)'
