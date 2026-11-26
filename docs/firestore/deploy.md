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

Still to do once, at first deploy:

- Firebase Authentication of `sbzero` → authorized domains: add `acc.sb0.tech` and
  `sb0-accounter.web.app`.
- Hosting custom domain `acc.sb0.tech` on site `sb0-accounter`, and its DNS records at Namecheap.
- Load reference data (roles, permissions, countries, VAT rates) and register the first super-admin
  (see "Bootstrap").

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

## Bootstrap

To be written with the bootstrap script: load reference data into `accounter`, register the first
super-admin by Firebase uid, then create the SB0 tenant with `bootstrapNewClient` and accept its
invitation.
