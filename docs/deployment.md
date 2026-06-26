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

## CI/CD model
- CI can stay lightweight in GitHub Actions: `pnpm install`, `pnpm typecheck`,
  `pnpm lint`, `pnpm test`, and `pnpm build`.
- CD is intentionally operated from this host through the project Codex skill, because this
  host already has the trusted `kubectl` context, private registry access, and tailnet reachability.
- Do not put kubeconfig, cluster-admin credentials, or deployment secrets into GitHub Actions
  unless the team explicitly decides to move deployment control out of this host.

## Codex-operated deployment
Use the project deployment skill as the release pipeline:

```bash
.codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh
```

The script performs preflight checks, builds `linux/amd64` API/web/realtime images,
pushes immutable git-sha tags plus the moving `:main` tag, applies k3s manifests,
runs the Prisma migration job, waits for rollouts, checks service endpoints, probes API
`/health`, probes the Traefik tailnet web route, and writes a release log under
`deployments/`.

Useful overrides:

```bash
IMAGE_TAG=<tag> K8S_CONTEXT=<context> REGISTRY=<host:port> \
WEB_HOST=web.hibi.internal TAILNET_PROBE_IP=100.74.225.115 \
.codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh
```

Verification only:

```bash
.codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh --verify-only
```

Disable the moving `:main` tag when a fully immutable-only release is desired:

```bash
PUSH_MOVING_TAG=0 .codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh
```

## Local dev
- `pnpm dev` runs web + api + realtime + a local Postgres (Docker). Seed with
  `pnpm db:seed` (two users + sample data).
