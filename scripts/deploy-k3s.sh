#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="hibi-portal"
IMAGE_TAG="${IMAGE_TAG:-main}"
REGISTRY="${REGISTRY:-server-main:30500}"
CONTEXT="${K8S_CONTEXT:-}"

if ! command -v kubectl > /dev/null 2>&1; then
  echo "kubectl is required but not installed."
  exit 1
fi

KUBECTL=(kubectl)
if [[ -n "${CONTEXT}" ]]; then
  KUBECTL+=("--context" "${CONTEXT}")
fi

apply_manifest() {
  local manifest="$1"
  sed "s#server-main:30500#${REGISTRY}#g" "${manifest}" | "${KUBECTL[@]}" apply -f -
}

MANIFESTS=(
  infra/k8s/postgres.yaml
  infra/k8s/api.yaml
  infra/k8s/web.yaml
  infra/k8s/realtime.yaml
  infra/k8s/cloudflared.yaml
  infra/k8s/ingress-routes.yaml
  infra/k8s/backup-cronjob.yaml
)

echo "Applying manifests..."
for manifest in "${MANIFESTS[@]}"; do
  apply_manifest "${manifest}"
done

echo "Updating deployment images to ${IMAGE_TAG}..."
"${KUBECTL[@]}" -n "${NAMESPACE}" set image deployment/hibi-api api="${REGISTRY}/hibi-wms-api:${IMAGE_TAG}"
"${KUBECTL[@]}" -n "${NAMESPACE}" set image deployment/hibi-web web="${REGISTRY}/hibi-wms-web:${IMAGE_TAG}"
"${KUBECTL[@]}" -n "${NAMESPACE}" set image deployment/hibi-realtime realtime="${REGISTRY}/hibi-wms-realtime:${IMAGE_TAG}"

echo "Re-running migration job..."
"${KUBECTL[@]}" -n "${NAMESPACE}" delete job hibi-api-migrate --ignore-not-found
apply_manifest infra/k8s/migrate-job.yaml
"${KUBECTL[@]}" -n "${NAMESPACE}" wait --for=condition=complete --timeout=180s job/hibi-api-migrate

echo "Restarting deployments for tag refresh..."
"${KUBECTL[@]}" -n "${NAMESPACE}" rollout restart deployment/hibi-api
"${KUBECTL[@]}" -n "${NAMESPACE}" rollout restart deployment/hibi-web
"${KUBECTL[@]}" -n "${NAMESPACE}" rollout restart deployment/hibi-realtime

"${KUBECTL[@]}" -n "${NAMESPACE}" rollout status deployment/hibi-api --timeout=180s
"${KUBECTL[@]}" -n "${NAMESPACE}" rollout status deployment/hibi-web --timeout=180s
"${KUBECTL[@]}" -n "${NAMESPACE}" rollout status deployment/hibi-realtime --timeout=180s

echo "Deployment finished."
