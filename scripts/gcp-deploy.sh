#!/usr/bin/env bash
set -euo pipefail

# Deploy Kaana API + four web apps to Cloud Run. Run from repo root.
# Usage: PROJECT_ID=... REGION=... bash scripts/gcp-deploy.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-$(gcloud config get-value compute/region 2>/dev/null || true)}"
SKIP_SEED="${SKIP_SEED:-0}"
SKIP_INFRA="${SKIP_INFRA:-0}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set PROJECT_ID or: gcloud config set project YOUR_PROJECT_ID" >&2
  exit 1
fi
if [[ -z "${REGION}" || "${REGION}" == "(unset)" ]]; then
  REGION="asia-south1"
fi

INSTANCE="kaana-pg"
REPO="kaana-docker"
CONNECTION="${PROJECT_ID}:${REGION}:${INSTANCE}"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
API_IMAGE="${REGISTRY}/kaana-api:latest"
API_RUNNER_SA="kaana-api-runner@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Project=${PROJECT_ID} Region=${REGION}"

gcloud_quiet() {
  gcloud "$@" --project "${PROJECT_ID}" --quiet
}

resource_exists() {
  gcloud "$@" --project "${PROJECT_ID}" >/dev/null 2>&1
}

ensure_secret() {
  local name="$1"
  local value="$2"
  if resource_exists secrets describe "$name"; then
    echo "Secret $name already exists"
    return
  fi
  printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --project "${PROJECT_ID}" --quiet
}

random_secret() {
  python3 - <<'PY'
import secrets, string
alphabet = string.ascii_letters + string.digits
print("".join(secrets.choice(alphabet) for _ in range(32)))
PY
}

service_url() {
  gcloud run services describe "$1" --project "${PROJECT_ID}" --region "${REGION}" --format="value(status.url)"
}

submit_api() {
  gcloud builds submit --project "${PROJECT_ID}" --config deploy/cloudbuild.api.yaml --substitutions "_IMAGE=${API_IMAGE}" --quiet
}

submit_web() {
  local image="$1" app_dir="$2" app_name="$3"
  gcloud builds submit --project "${PROJECT_ID}" --config deploy/cloudbuild.web.yaml --quiet --substitutions \
    "_IMAGE=${image},_APP_DIR=${app_dir},_APP_NAME=${app_name},_NEXT_PUBLIC_API_URL=${API_PUBLIC},_NEXT_PUBLIC_WS_URL=${WS_PUBLIC},_NEXT_PUBLIC_HUB_URL=${HUB_PUBLIC},_NEXT_PUBLIC_OPERATIONS_WEB_URL=${OPS_URL},_NEXT_PUBLIC_POS_WEB_URL=${POS_URL},_NEXT_PUBLIC_KDS_WEB_URL=${KDS_URL},_NEXT_PUBLIC_CAPTAIN_WEB_URL=${CAPTAIN_URL}"
}

deploy_web() {
  local name="$1" image="$2"
  env_file="$(mktemp)"
  printf 'NODE_ENV: production\n' > "${env_file}"
  gcloud run deploy "$name" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --image "${image}" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 512Mi \
    --cpu 1 \
    --timeout 300 \
    --min-instances 0 \
    --max-instances 10 \
    --no-invoker-iam-check \
    --env-vars-file "${env_file}" \
    --quiet
  rm -f "${env_file}"
}

deploy_api() {
  local cors="${1:-}"
  env_file="$(mktemp)"
  {
    echo "NODE_ENV: production"
    echo "JWT_EXPIRES_IN: 15m"
    echo "JWT_REFRESH_EXPIRES_IN: 7d"
    if [[ -n "${cors}" ]]; then
      echo "CORS_ORIGINS: ${cors}"
    fi
  } > "${env_file}"
  gcloud run deploy kaana-api \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --image "${API_IMAGE}" \
    --platform managed \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 3600 \
    --min-instances 0 \
    --max-instances 10 \
    --session-affinity \
    --no-invoker-iam-check \
    --add-cloudsql-instances "${CONNECTION}" \
    --set-secrets "DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest" \
    --service-account "${API_RUNNER_SA}" \
    --env-vars-file "${env_file}" \
    --quiet
  rm -f "${env_file}"
}

if [[ "${SKIP_INFRA}" != "1" ]]; then
  gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    --project "${PROJECT_ID}" --quiet

  if ! resource_exists artifacts repositories describe "${REPO}" --location "${REGION}"; then
    gcloud artifacts repositories create "${REPO}" \
      --repository-format=docker \
      --location "${REGION}" \
      --project "${PROJECT_ID}" \
      --quiet
  fi

  PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
  COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
  if ! resource_exists iam service-accounts describe "${API_RUNNER_SA}"; then
    gcloud iam service-accounts create kaana-api-runner --display-name "Kaana API Cloud Run" --project "${PROJECT_ID}" --quiet
  fi
  for sa in "${API_RUNNER_SA}" "${COMPUTE_SA}"; do
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${sa}" --role="roles/cloudsql.client" --quiet >/dev/null
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${sa}" --role="roles/secretmanager.secretAccessor" --quiet >/dev/null
  done
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${BUILD_SA}" --role="roles/artifactregistry.writer" --quiet >/dev/null
  gcloud iam service-accounts add-iam-policy-binding "${API_RUNNER_SA}" --member="serviceAccount:${COMPUTE_SA}" --role="roles/iam.serviceAccountUser" --project "${PROJECT_ID}" --quiet >/dev/null

  if ! resource_exists sql instances describe "${INSTANCE}"; then
    echo "Creating Cloud SQL ${INSTANCE}..."
    ROOT_PW="$(random_secret)"
    gcloud sql instances create "${INSTANCE}" \
      --database-version=POSTGRES_16 \
      --edition=ENTERPRISE \
      --tier=db-f1-micro \
      --region "${REGION}" \
      --project "${PROJECT_ID}" \
      --storage-size=10 \
      --root-password="${ROOT_PW}" \
      --quiet
  fi

  if resource_exists secrets describe KAANA_DB_PASSWORD; then
    DB_PASSWORD="$(gcloud secrets versions access latest --secret=KAANA_DB_PASSWORD --project "${PROJECT_ID}")"
  else
    DB_PASSWORD="$(random_secret)"
    ensure_secret KAANA_DB_PASSWORD "${DB_PASSWORD}"
  fi

  if ! gcloud sql databases list --instance "${INSTANCE}" --project "${PROJECT_ID}" --format='value(name)' | grep -qx kaana_foods; then
    gcloud sql databases create kaana_foods --instance "${INSTANCE}" --project "${PROJECT_ID}" --quiet
  fi

  if gcloud sql users list --instance "${INSTANCE}" --project "${PROJECT_ID}" --format='value(name)' | grep -qx kaana; then
    gcloud sql users set-password kaana --instance "${INSTANCE}" --project "${PROJECT_ID}" --password "${DB_PASSWORD}" --quiet
  else
    gcloud sql users create kaana --instance "${INSTANCE}" --project "${PROJECT_ID}" --password "${DB_PASSWORD}" --quiet
  fi

  DATABASE_URL="postgresql://kaana:${DB_PASSWORD}@localhost/kaana_foods?host=/cloudsql/${CONNECTION}&schema=public"
  ensure_secret DATABASE_URL "${DATABASE_URL}"
  ensure_secret JWT_SECRET "$(random_secret)"
  ensure_secret JWT_REFRESH_SECRET "$(random_secret)"
fi

echo "Building API image..."
submit_api
echo "Deploying API..."
deploy_api

API_URL="$(service_url kaana-api)"
API_PUBLIC="${API_URL}/api"
WS_PUBLIC="${API_URL}/events"
HUB_PUBLIC="http://localhost:4100"
echo "API: ${API_URL}"

if [[ "${SKIP_SEED}" != "1" ]]; then
  echo "Pushing schema via Cloud SQL Auth Proxy..."
  DB_PASSWORD="${DB_PASSWORD:-$(gcloud secrets versions access latest --secret=KAANA_DB_PASSWORD --project "${PROJECT_ID}")}"
  PROXY_BIN="${TMPDIR:-/tmp}/cloud-sql-proxy"
  if ! command -v cloud-sql-proxy >/dev/null 2>&1; then
    curl -fsSL -o "${PROXY_BIN}" "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.25.3/cloud-sql-proxy.linux.amd64"
    chmod +x "${PROXY_BIN}"
  else
    PROXY_BIN="$(command -v cloud-sql-proxy)"
  fi
  "${PROXY_BIN}" "${CONNECTION}" --port=6543 &
  PROXY_PID=$!
  sleep 4
  set +e
  DATABASE_URL="postgresql://kaana:${DB_PASSWORD}@127.0.0.1:6543/kaana_foods?schema=public" \
    npx prisma db push --schema=packages/database/prisma/schema.prisma --skip-generate
  DATABASE_URL="postgresql://kaana:${DB_PASSWORD}@127.0.0.1:6543/kaana_foods?schema=public" \
    npm run db:seed -w @kaana/database
  set -e
  kill "${PROXY_PID}" >/dev/null 2>&1 || true
fi

OPS_URL="http://localhost:3010"
POS_URL="http://localhost:3001"
KDS_URL="http://localhost:3002"
CAPTAIN_URL="http://localhost:3003"

if resource_exists run services describe kaana-operations-web --region "${REGION}"; then OPS_URL="$(service_url kaana-operations-web)"; fi
if resource_exists run services describe kaana-pos-web --region "${REGION}"; then POS_URL="$(service_url kaana-pos-web)"; fi
if resource_exists run services describe kaana-kds-web --region "${REGION}"; then KDS_URL="$(service_url kaana-kds-web)"; fi
if resource_exists run services describe kaana-captain-web --region "${REGION}"; then CAPTAIN_URL="$(service_url kaana-captain-web)"; fi

deploy_web_app() {
  local name="$1" dir="$2" pkg="$3"
  local image="${REGISTRY}/${name}:latest"
  submit_web "${image}" "${dir}" "${pkg}"
  deploy_web "${name}" "${image}"
  case "${name}" in
    kaana-operations-web) OPS_URL="$(service_url "${name}")" ;;
    kaana-pos-web) POS_URL="$(service_url "${name}")" ;;
    kaana-kds-web) KDS_URL="$(service_url "${name}")" ;;
    kaana-captain-web) CAPTAIN_URL="$(service_url "${name}")" ;;
  esac
  echo "${name}: $(service_url "${name}")"
}

echo "Building and deploying web apps..."
deploy_web_app kaana-operations-web apps/operations-web @kaana/operations-web
deploy_web_app kaana-pos-web apps/pos-web @kaana/pos-web
deploy_web_app kaana-kds-web apps/kds-web @kaana/kds-web
deploy_web_app kaana-captain-web apps/captain-web @kaana/captain-web

echo "Rebuilding web apps with production URLs..."
deploy_web_app kaana-operations-web apps/operations-web @kaana/operations-web
deploy_web_app kaana-pos-web apps/pos-web @kaana/pos-web
deploy_web_app kaana-kds-web apps/kds-web @kaana/kds-web
deploy_web_app kaana-captain-web apps/captain-web @kaana/captain-web

CORS="${OPS_URL},${POS_URL},${KDS_URL},${CAPTAIN_URL}"
echo "Updating API CORS..."
deploy_api "${CORS}"

echo
echo "Deployed:"
echo "  API         ${API_URL}"
echo "  Operations  ${OPS_URL}"
echo "  POS         ${POS_URL}"
echo "  KDS         ${KDS_URL}"
echo "  Captain     ${CAPTAIN_URL}"
echo "Health: ${API_URL}/api/health"
echo "Sign in at ${OPS_URL}  (owner@kaanafoods.in / password123)"
