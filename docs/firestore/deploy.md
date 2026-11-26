# Deploying Accounter on Google Cloud (acc.sb0.tech)

## What runs where

| Piece       | Where                                                                 |
| ----------- | --------------------------------------------------------------------- |
| GraphQL API | Cloud Run `accounter-api`, project `sbzero`, region `me-west1`        |
| Database    | Firestore database `accounter`, project `sbzero`, location `me-west1` |
| Sign-in     | Firebase Authentication of project `sbzero` (web app "Accounter")     |
| Web app     | Firebase Hosting site `sb0-accounter`, project `sb0-accounter`        |
| Domain      | `acc.sb0.tech` → the Hosting site (DNS at Namecheap)                  |

`sbzero` also runs other services and two other Firestore databases. Everything Accounter adds there
is additive and named `accounter*`; nothing else in the project is changed.

## One-time setup (done 2026-11-26)

- Firestore database `accounter` in `me-west1`: delete protection on, point-in-time recovery (7
  days), daily backups kept 14 days.
- Rules release `cloud.firestore/accounter`: deny all (`deploy/firestore.rules`). Only the API, with
  the Admin SDK, reads and writes it.
- Service account `accounter-api@sbzero.iam.gserviceaccount.com`:
  - `roles/datastore.user` with an IAM condition limiting it to the `accounter` database;
  - `roles/firebaseauth.admin` (invitations create and look up users);
  - `secretmanager.secretAccessor` on `accounter-credentials-encryption-key` only.
- Secret `accounter-credentials-encryption-key`: 32 random bytes as hex (encrypts stored provider
  credentials; never rotate it without re-encrypting them).
- Firebase web app "Accounter" in `sbzero` (`1:678576192331:web:78d595b06bd95d726dc6ce`).
- Project `sb0-accounter` (organization empaako.com) with Firebase Hosting site `sb0-accounter`.

- Firebase Authentication of `sbzero`: `acc.sb0.tech`, `sb0-accounter.web.app` and
  `sb0-accounter.firebaseapp.com` added to the authorized domains (existing entries kept). The web
  app's browser key has no referrer restriction and allows Identity Toolkit and Secure Token.
- Hosting custom domain `acc.sb0.tech` on site `sb0-accounter`. DNS at Namecheap: one record,
  `CNAME acc → sb0-accounter.web.app`. The certificate is issued once the record resolves.
- Reference data (roles, permissions, countries, VAT rates: 266 documents) imported.

## Shared user pool

Firebase Authentication of `sbzero` is shared with the project's other apps. Accounter therefore
never disables or deletes an existing account: an invitee's account is created if missing, marked
with custom claims, and only an account Accounter created that has never signed in may be deleted by
invitation cleanup. Access to Accounter itself comes from `business_users` membership.

## Deploying

```sh
deploy/deploy-server.sh # checks every query is ported, builds, deploys accounter-api
deploy/deploy-client.sh # builds the web app against the API URL, deploys Hosting
```

The API runs with one instance (`--min-instances 1 --max-instances 1`): the design keeps a live
replica per instance and serialises writes in one process (docs/firestore/design.md). Raising
`max-instances` is safe for reads; concurrent writes from several instances then rely on Firestore
preconditions and surface as serialisation errors (40001) rather than lost updates.

## Bootstrap (a new installation)

1. Reference data, from a local migrated Postgres:

   ```sh
   cd packages/server
   POSTGRES_DB=accounter_bootstrap yarn firestore:bootstrap-db
   FIRESTORE_PROJECT_ID=sbzero POSTGRES_DB=accounter_bootstrap yarn firestore:import
   ```

2. The first super-admin signs in once at https://acc.sb0.tech (Google), which creates their
   Firebase account; the app shows they have no business yet. Then:

   ```sh
   FIREBASE_AUTH_PROJECT_ID=sbzero FIRESTORE_PROJECT_ID=sbzero \
     yarn firestore:add-super-admin --email asaf@sb0.tech
   ```

3. The super-admin creates the first business with the `bootstrapNewClient` mutation
   (docs/super-user/super-admin-runbook.md), naming its owner's email, and the owner accepts the
   invitation in the app.

Both scripts need Application Default Credentials (`gcloud auth application-default login`).

## Known differences from Postgres

- Foreign keys from a global table to tenant tables (e.g. a depreciation category) are checked only
  against tenants this instance has loaded. With one business per installation that is every tenant.
- `ON UPDATE CASCADE` is not automatic; the one query that renames a referenced key moves its
  children itself.
- Daily jobs (expired invitations, price-index sync) run on in-process timers; with Cloud Run's
  request-only CPU they run when the instance is next active.
