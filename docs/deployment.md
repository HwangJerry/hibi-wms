# Deployment

## Images
- One image each for `api`, `realtime`, and `web` (web can be static files served by a
  tiny server or by Traefik). Multi-stage Dockerfiles; non-root user; pinned base images.
- Push to the configured private registry.
  Example used in this project: `100.74.225.115:30500`.
  Tag with git sha + a moving `:main`.
- Platform note: when building on arm64 hosts, build images for `linux/amd64` to match the cluster nodes:

  - `docker build --platform linux/amd64 -f packages/api/Dockerfile -t 100.74.225.115:30500/hibi-wms-api:main .`
  - `docker build --platform linux/amd64 -f apps/web/Dockerfile -t 100.74.225.115:30500/hibi-wms-web:main .`
  - `docker build --platform linux/amd64 -f apps/realtime/Dockerfile -t 100.74.225.115:30500/hibi-wms-realtime:main .`

## Manifests
- Keep manifests in `infra/` (Helm chart or Kustomize — pick one, document it).
- Per workload:
  - `web`, `api`: Deployment (1–2 replicas) + Service.
  - `realtime`: Deployment **(1 replica, fixed)** + Service.
  - `postgres`: StatefulSet/Deployment pinned to node A + local-path PVC + Service.
  - `cloudflared`: Deployment (2 replicas) + config/secret.
  - Ingress: Traefik IngressRoute per hostname.

## Secrets
- k8s **Secrets** for: database URL, session secret, R2 credentials, Cloudflare tunnel
  token. Never in images or git. Consider **sealed-secrets** if you want them in the repo
  safely.

## Database migrations
- Run `prisma migrate deploy` as a **Job** (or initContainer) on release, before the new
  `api` rolls out. Migrations are forward-only; never edit a shipped migration.

## CI (lightweight)
- On push: `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`,
  then build + push images. Deploy can be `kubectl`/`helm` from CI or a manual step —
  GitOps (Argo/Flux) is optional and likely overkill for two people.

## Local dev
- `pnpm dev` runs web + api + realtime + a local Postgres (Docker). Seed with
  `pnpm db:seed` (two users + sample data).
