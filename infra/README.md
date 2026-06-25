# Infra Deploy Guide

## Manifests used
- This directory uses plain Kubernetes manifests under `infra/k8s` (no Helm chart and no Kustomize templates).
- `kubectl` applies the files directly.

## Image build platform requirement
- The target k3s nodes for this deployment are `amd64`. If you build on an `arm64` machine (for example, Apple Silicon), use:

  - `docker build --platform linux/amd64 -t 100.74.225.115:30500/hibi-wms-api:main -f packages/api/Dockerfile .`
  - `docker build --platform linux/amd64 -t 100.74.225.115:30500/hibi-wms-web:main -f apps/web/Dockerfile .`
  - `docker build --platform linux/amd64 -t 100.74.225.115:30500/hibi-wms-realtime:main -f apps/realtime/Dockerfile .`

  Without forcing `linux/amd64`, arm64-built images will fail at runtime with `exec format error`.

## What's included
- `infra/k8s/postgres.yaml`
  - PostgreSQL `StatefulSet` pinned to node A via node affinity.
  - `local-path` PVC + namespace-scoped `Service`.
  - NodePort service removed.
- `infra/k8s/api.yaml`
  - `Deployment` + `Service` for API (`1-2` replicas; set to `2` here).
  - Pulls images from private registry `100.74.225.115:30500/hibi-wms-*`.
- `infra/k8s/web.yaml`
  - `Deployment` + `Service` for web (`1-2` replicas; set to `2` here).
- `infra/k8s/realtime.yaml`
  - `Deployment` + `Service` for realtime (`fixed` `1` replica).
- `infra/k8s/cloudflared.yaml`
  - `ConfigMap` for tunnel ingress mapping hostnames to Traefik Service.
  - `Deployment` (2 replicas) that runs with token from k8s Secret.
- `infra/k8s/ingress-routes.yaml`
  - Traefik `IngressRoute` per hostname.
- `infra/k8s/migrate-job.yaml`
  - One-off `Job` that runs `prisma migrate deploy` from the API image.
- `infra/k8s/backup-cronjob.yaml`
  - Hourly `CronJob` that runs `pg_dump`, uploads to R2, and prunes old backups by retention.
- `infra/k8s/secrets.example.yaml`
  - Secret templates for all required secrets.

## Deploy steps
1. Create real secret values from your environment:
   - `kubectl create secret generic hibi-postgres --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" -n hibi-portal`
   - `kubectl create secret generic hibi-app-secrets --from-literal=DATABASE_URL="$DATABASE_URL" --from-literal=SESSION_SECRET="$SESSION_SECRET" --from-literal=R2_ACCOUNT_ID="$R2_ACCOUNT_ID" --from-literal=R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" --from-literal=R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" --from-literal=R2_BUCKET_NAME="$R2_BUCKET_NAME" --from-literal=R2_ENDPOINT="$R2_ENDPOINT" -n hibi-portal`
   - `kubectl create secret generic hibi-cloudflared --from-literal=CLOUDFLARED_TUNNEL_TOKEN="$CLOUDFLARED_TUNNEL_TOKEN" -n hibi-portal`
2. Apply DB layer and run schema migrations first:
   - `kubectl apply -f infra/k8s/postgres.yaml`
   - `kubectl apply -f infra/k8s/migrate-job.yaml`
   - `kubectl wait --for=condition=complete --timeout=180s job/hibi-api-migrate`
3. Apply services:
   - `kubectl apply -f infra/k8s/api.yaml -f infra/k8s/web.yaml -f infra/k8s/realtime.yaml -f infra/k8s/cloudflared.yaml -f infra/k8s/ingress-routes.yaml -f infra/k8s/backup-cronjob.yaml`
4. Update hostnames in:
   - `infra/k8s/ingress-routes.yaml`
   - `infra/k8s/cloudflared.yaml`
   with actual DNS names from your Cloudflare tunnel.

5. On future rollouts:
   - `kubectl apply -f infra/k8s/migrate-job.yaml`
   - `kubectl wait --for=condition=complete --timeout=180s job/hibi-api-migrate`
   - `kubectl apply -f infra/k8s/api.yaml -f infra/k8s/web.yaml`

## Validation
- Render/manifest check:
  - `kubectl apply --dry-run=client -f infra/k8s/postgres.yaml -f infra/k8s/api.yaml -f infra/k8s/web.yaml -f infra/k8s/realtime.yaml -f infra/k8s/cloudflared.yaml -f infra/k8s/ingress-routes.yaml -f infra/k8s/migrate-job.yaml -f infra/k8s/backup-cronjob.yaml`
  - If your shell returns `no matches for kind \"IngressRoute\"`, confirm Traefik CRDs in the cluster and verify the API version in `infra/k8s/ingress-routes.yaml` matches your k3s release.
- Backup verification:
  - `kubectl get cronjob -n hibi-portal hibi-db-backup`
  - `kubectl logs -n hibi-portal -l job-name=hibi-db-backup --tail=40`
- Reachability test:
  - Configure Cloudflare tunnel hostnames to point at your `api.example.internal`, `web.example.internal`, `realtime.example.internal` names used above.
  - Open each hostname in browser after tunnel is healthy.

## Scripted rollout

Use:

`K8S_CONTEXT=<your-context> IMAGE_TAG=<tag-or-main> scripts/deploy-k3s.sh`

with `IMAGE_TAG` defaulting to `main`.
