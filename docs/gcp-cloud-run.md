# Cloud Run deploy (Kaana)

Project: `crucial-accord-505607-g9` (or `GCP_PROJECT_ID`). Region: existing Compute region, otherwise `asia-south1`.

## First deploy (local)

1. `gcloud auth login` and `gcloud config set project YOUR_PROJECT_ID`
2. Billing must be enabled on the project
3. From the repo root (PowerShell):

```powershell
.\scripts\gcp-deploy.ps1
```

This creates Artifact Registry, Cloud SQL Postgres 16 (`kaana-pg`), Secret Manager values, builds five images, runs `prisma db push` + seed, then deploys:

| Service | URL |
|---|---|
| `kaana-api` | https://kaana-api-888176696307.asia-south1.run.app |
| `kaana-operations-web` | https://kaana-operations-web-888176696307.asia-south1.run.app |
| `kaana-pos-web` | https://kaana-pos-web-888176696307.asia-south1.run.app |
| `kaana-kds-web` | https://kaana-kds-web-888176696307.asia-south1.run.app |
| `kaana-captain-web` | https://kaana-captain-web-888176696307.asia-south1.run.app |

Sign in at operations-web as `owner@kaanafoods.in` / `password123`.

The org policy blocks `allUsers` IAM bindings, so deploys use `--no-invoker-iam-check` (public HTTPS without a `run.invoker` grant). `--allow-unauthenticated` alone is not enough in this project.

Flags: `-SkipSeed` if the database is already populated; `-SkipInfra` to only rebuild/redeploy.

## GitHub Actions (push to main)

Add repository secrets:

- `GCP_SA_KEY` — JSON key for a deploy service account with Cloud Run Admin, Cloud Build Editor, Artifact Registry Writer, Secret Manager Secret Accessor, Cloud SQL Client/Admin
- `GCP_PROJECT_ID`
- `GCP_REGION` — e.g. `asia-south1`

CI sets `SKIP_SEED=1` so production data is not re-seeded on every deploy.

## Secrets (not in git)

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | Cloud SQL unix socket URL used by Cloud Run |
| `KAANA_DB_PASSWORD` | Postgres user `kaana` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Auth |

Rotate JWT: create a new Secret Manager version, then redeploy `kaana-api`. Existing sessions will be invalid.

Re-seed (destroys demo uniqueness if rows exist):

```powershell
.\scripts\gcp-deploy.ps1 -SkipInfra
```

Use a one-off Cloud SQL Auth Proxy + `npm run db:seed -w @kaana/database` if you only need seed.

## Health

`GET https://<kaana-api>/api/health` should return `{ "status": "ok" }`.
