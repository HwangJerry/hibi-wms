#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-hibi-portal}"
K8S_CONTEXT="${K8S_CONTEXT:-default}"
REGISTRY="${REGISTRY:-100.74.225.115:30500}"
PLATFORM="${PLATFORM:-linux/amd64}"
WEB_HOST="${WEB_HOST:-web.hibi.internal}"
TAILNET_PROBE_IP="${TAILNET_PROBE_IP:-100.74.225.115}"
MOVING_TAG="${MOVING_TAG:-main}"
PUSH_MOVING_TAG="${PUSH_MOVING_TAG:-1}"
RELEASE_LOG_DIR="${RELEASE_LOG_DIR:-deployments}"

GIT_SHA="unknown"
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_SHA="$(git rev-parse --short HEAD)"
fi

IMAGE_TAG="${IMAGE_TAG:-$GIT_SHA}"

VERIFY_ONLY=0
SKIP_BUILD=0
SKIP_PUSH=0
SKIP_DEPLOY=0

usage() {
  cat <<USAGE
Usage: $0 [--verify-only] [--skip-build] [--skip-push] [--skip-deploy]

Environment:
  NAMESPACE=${NAMESPACE}
  IMAGE_TAG=${IMAGE_TAG}
  MOVING_TAG=${MOVING_TAG}
  PUSH_MOVING_TAG=${PUSH_MOVING_TAG}
  K8S_CONTEXT=${K8S_CONTEXT}
  REGISTRY=${REGISTRY}
  PLATFORM=${PLATFORM}
  WEB_HOST=${WEB_HOST}
  TAILNET_PROBE_IP=${TAILNET_PROBE_IP}
  RELEASE_LOG_DIR=${RELEASE_LOG_DIR}
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --verify-only)
      VERIFY_ONLY=1
      SKIP_BUILD=1
      SKIP_PUSH=1
      SKIP_DEPLOY=1
      ;;
    --skip-build)
      SKIP_BUILD=1
      ;;
    --skip-push)
      SKIP_PUSH=1
      ;;
    --skip-deploy)
      SKIP_DEPLOY=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run() {
  echo "+ $*"
  "$@"
}

kubectl_cmd() {
  kubectl --context "$K8S_CONTEXT" "$@"
}

preflight() {
  echo "+ preflight checks"
  run kubectl_cmd config current-context
  run docker info >/dev/null

  if command -v curl >/dev/null 2>&1; then
    REGISTRY_STATUS="$(curl -sS -o /tmp/hibi-portal-registry-probe.out -w '%{http_code}' "http://$REGISTRY/v2/" || true)"
    if [[ "$REGISTRY_STATUS" != "200" && "$REGISTRY_STATUS" != "401" ]]; then
      echo "Registry probe failed for http://$REGISTRY/v2/ with HTTP $REGISTRY_STATUS." >&2
      exit 1
    fi
  fi

  if kubectl_cmd get namespace "$NAMESPACE" >/dev/null 2>&1; then
    if ! kubectl_cmd -n "$NAMESPACE" get secret hibi-app-secrets >/dev/null 2>&1; then
      echo "Missing required secret: $NAMESPACE/hibi-app-secrets" >&2
      exit 1
    fi
  else
    echo "Namespace $NAMESPACE does not exist yet; manifests will create it if this is a first deploy."
  fi
}

tag_moving_image() {
  local image_name="$1"

  if [[ "$PUSH_MOVING_TAG" -eq 1 && "$IMAGE_TAG" != "$MOVING_TAG" ]]; then
    run docker tag "$REGISTRY/$image_name:$IMAGE_TAG" "$REGISTRY/$image_name:$MOVING_TAG"
  fi
}

push_image() {
  local image_name="$1"

  run docker push "$REGISTRY/$image_name:$IMAGE_TAG"
  if [[ "$PUSH_MOVING_TAG" -eq 1 && "$IMAGE_TAG" != "$MOVING_TAG" ]]; then
    run docker push "$REGISTRY/$image_name:$MOVING_TAG"
  fi
}

smoke_api_health() {
  local port_forward_pid=""
  local api_health_code=""

  if ! command -v curl >/dev/null 2>&1; then
    echo "Skipping API smoke check because curl is not installed."
    return
  fi

  echo "+ probing API health through kubectl port-forward"
  kubectl_cmd -n "$NAMESPACE" port-forward svc/hibi-api 18080:3000 >/tmp/hibi-portal-api-port-forward.log 2>&1 &
  port_forward_pid="$!"
  trap 'if [[ -n "${port_forward_pid:-}" ]]; then kill "$port_forward_pid" >/dev/null 2>&1 || true; fi' RETURN

  sleep 2
  api_health_code="$(curl -sS -o /tmp/hibi-portal-api-health.out -w '%{http_code}' http://127.0.0.1:18080/health || true)"
  kill "$port_forward_pid" >/dev/null 2>&1 || true
  port_forward_pid=""

  if [[ "$api_health_code" != "200" ]]; then
    echo "API health smoke check failed with HTTP $api_health_code." >&2
    cat /tmp/hibi-portal-api-port-forward.log >&2 || true
    exit 1
  fi
}

write_release_log() {
  local timestamp
  local release_log

  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  release_log="$RELEASE_LOG_DIR/$timestamp-$IMAGE_TAG.md"
  mkdir -p "$RELEASE_LOG_DIR"

  cat > "$release_log" <<LOG
# Hibi Portal Deployment

- Timestamp: $timestamp
- Git SHA: $GIT_SHA
- Image tag: $IMAGE_TAG
- Moving tag pushed: $PUSH_MOVING_TAG
- Registry: $REGISTRY
- Namespace: $NAMESPACE
- Kubernetes context: $K8S_CONTEXT
- Platform: $PLATFORM
- Web host: $WEB_HOST
- Tailnet probe IP: $TAILNET_PROBE_IP

## Workloads

\`\`\`
$(kubectl_cmd -n "$NAMESPACE" get deploy,pods,job -o wide 2>&1)
\`\`\`

## Images

\`\`\`
$(kubectl_cmd -n "$NAMESPACE" get deploy hibi-api hibi-web hibi-realtime -o jsonpath='{range .items[*]}{.metadata.name}{" "}{range .spec.template.spec.containers[*]}{.image}{" "}{end}{"\n"}{end}' 2>&1)
\`\`\`
LOG

  echo "Release log written: $release_log"
}

require_command pnpm
require_command docker
require_command kubectl

preflight

if [[ "$VERIFY_ONLY" -eq 0 && "$SKIP_BUILD" -eq 0 ]]; then
  run pnpm --filter @hibi/core build
  run pnpm --filter @hibi/auth build
  run pnpm --filter @hibi/ui build
  run pnpm --filter @hibi/api build
  run pnpm --filter @hibi/web build
  run pnpm --filter @hibi/realtime build

  run docker build --platform "$PLATFORM" -f packages/api/Dockerfile -t "$REGISTRY/hibi-wms-api:$IMAGE_TAG" .
  run docker build --platform "$PLATFORM" -f apps/web/Dockerfile -t "$REGISTRY/hibi-wms-web:$IMAGE_TAG" .
  run docker build --platform "$PLATFORM" -f apps/realtime/Dockerfile -t "$REGISTRY/hibi-wms-realtime:$IMAGE_TAG" .
  tag_moving_image hibi-wms-api
  tag_moving_image hibi-wms-web
  tag_moving_image hibi-wms-realtime
fi

if [[ "$VERIFY_ONLY" -eq 0 && "$SKIP_PUSH" -eq 0 ]]; then
  push_image hibi-wms-api
  push_image hibi-wms-web
  push_image hibi-wms-realtime
fi

if [[ "$VERIFY_ONLY" -eq 0 && "$SKIP_DEPLOY" -eq 0 ]]; then
  run env IMAGE_TAG="$IMAGE_TAG" K8S_CONTEXT="$K8S_CONTEXT" REGISTRY="$REGISTRY" scripts/deploy-k3s.sh
fi

echo "+ verifying rollout status"
run kubectl_cmd -n "$NAMESPACE" rollout status deployment/hibi-api --timeout=180s
run kubectl_cmd -n "$NAMESPACE" rollout status deployment/hibi-web --timeout=180s
run kubectl_cmd -n "$NAMESPACE" rollout status deployment/hibi-realtime --timeout=180s

echo "+ verifying migration job"
run kubectl_cmd -n "$NAMESPACE" get job hibi-api-migrate -o wide

echo "+ current workloads"
run kubectl_cmd -n "$NAMESPACE" get deploy,pods,job -o wide

echo "+ service endpoints"
run kubectl_cmd -n "$NAMESPACE" get endpoints hibi-api hibi-web hibi-realtime hibi-postgres -o wide

smoke_api_health

TRAEFIK_NODE_PORT="$(kubectl_cmd -n kube-system get svc traefik -o jsonpath='{.spec.ports[?(@.name=="web")].nodePort}' 2>/dev/null || true)"
if [[ -n "$TRAEFIK_NODE_PORT" ]] && command -v curl >/dev/null 2>&1; then
  echo "+ probing tailnet web route"
  HTTP_CODE="$(curl -sS -o /tmp/hibi-portal-web-probe.out -w '%{http_code}' -H "Host: $WEB_HOST" "http://$TAILNET_PROBE_IP:$TRAEFIK_NODE_PORT/" || true)"
  echo "tailnet web probe: http://$WEB_HOST:$TRAEFIK_NODE_PORT via $TAILNET_PROBE_IP => $HTTP_CODE"
  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "Tailnet web probe failed. Check Traefik IngressRoute and NodePort." >&2
    exit 1
  fi
fi

if ! kubectl_cmd -n "$NAMESPACE" get deploy hibi-cloudflared -o jsonpath='{.status.readyReplicas}' 2>/dev/null | grep -qx '2'; then
  echo "Warning: hibi-cloudflared is not fully ready. App deployment can still be healthy; Cloudflare public access may be down." >&2
fi

write_release_log

echo "Hibi Portal k3s deployment verification complete."
