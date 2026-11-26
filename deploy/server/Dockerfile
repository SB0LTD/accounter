# Accounter API for Cloud Run, on the Firestore engine (docs/firestore/design.md).
#
# Built from the staging directory deploy/stage-server.mjs prepares: every workspace manifest, the
# lockfile, Yarn itself, and the server's (and its workspace dependencies') prebuilt dist output.
# Only production dependencies are installed here.
FROM node:26-slim

ENV NODE_ENV=production \
    RELEASE=1 \
    ACCOUNTER_DB_ENGINE=firestore

WORKDIR /app
COPY . .
RUN node .yarn/releases/yarn-4.19.0.cjs workspaces focus @accounter/server --production \
 && node .yarn/releases/yarn-4.19.0.cjs cache clean --all \
 && rm -rf /tmp/* /root/.yarn

WORKDIR /app/packages/server
USER node
EXPOSE 4000
CMD ["node", "--import", "./dist/bootstrap-telemetry.js", "dist/index.js"]
