---
name: deploy-k3s-portal
description: Project-scoped Hibi Portal k3s deployment workflow. Use when asked to deploy, redeploy, verify rollout, build/push linux/amd64 images, run scripts/deploy-k3s.sh, check k3s workload health, or diagnose deployment status for this repository.
---

# Deploy k3s Portal

Use this skill for Hibi Portal deployments from this repo to the two-node k3s cluster.

## Default Workflow

Run the bundled script from the repo root:

```bash
.codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh
```

The script performs:

1. Local build validation for deploy-relevant packages.
2. Preflight checks for the k8s context, Docker, registry reachability, and required secrets.
3. Docker image builds with `--platform linux/amd64`.
4. Pushes API, web, and realtime images to `100.74.225.115:30500`.
5. Runs `scripts/deploy-k3s.sh`.
6. Verifies migration job, rollouts, pods, endpoints, API `/health`, and tailnet web reachability.
7. Writes a release log under `deployments/`.

## Important Defaults

- Registry: `100.74.225.115:30500`
- Image tag: current git short SHA when available
- Moving tag: `main`
- Push moving tag: enabled
- Platform: `linux/amd64`
- Namespace: `hibi-portal`
- k8s context: `default`
- Web host rule: `web.hibi.internal`
- Tailnet probe IP: `100.74.225.115`
- Release log directory: `deployments`

Override them with environment variables:

```bash
IMAGE_TAG=<tag> MOVING_TAG=main PUSH_MOVING_TAG=1 \
K8S_CONTEXT=<context> REGISTRY=<host:port> \
WEB_HOST=web.hibi.internal TAILNET_PROBE_IP=100.74.225.115 \
.codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh
```

For immutable deploys, omit `IMAGE_TAG`; the script uses `git rev-parse --short HEAD`.
It also pushes `:main` by default for operators that want a moving tag for quick inspection.

## Fast Verification Only

Use this after a deployment when the user asks whether it is deployed:

```bash
.codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh --verify-only
```

Verification still runs preflight, rollout checks, endpoint checks, API `/health`, tailnet
web reachability, and release-log writing. It skips build, push, and deploy.

## Partial Runs

Use only when intentionally skipping expensive work:

```bash
.codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh --skip-build
.codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh --skip-push
.codex/skills/deploy-k3s-portal/scripts/deploy_k3s_portal.sh --skip-deploy
```

## Health Interpretation

- `hibi-api`, `hibi-web`, `hibi-realtime`, `hibi-postgres`, and `hibi-api-migrate` must be healthy for app deployment success.
- `hibi-cloudflared` may remain unhealthy if the Cloudflare token is invalid. Treat this as external-public-access failure, not app deployment failure.
- Tailnet access uses Traefik NodePort. Verify with `Host: web.hibi.internal`.

## Known Failure Patterns

- `Unexpected token '<'`: `/trpc` is routed to web nginx instead of API. Check `infra/k8s/ingress-routes.yaml` path routes.
- `exec format error`: image was not built as `linux/amd64`.
- `node_modules/.bin/prisma: not found`: migration command must use `packages/db/node_modules/.bin/prisma`.
- Prisma engine write permission error: API runtime image must keep `/app` writable by `node`.
- Login loops on HTTP tailnet access: `SESSION_COOKIE_SECURE=false` must be set on the API deployment.
- API smoke check failed: inspect `/tmp/hibi-portal-api-port-forward.log`, then run
  `kubectl -n hibi-portal logs deploy/hibi-api`.
- Registry probe failed: confirm the local registry is reachable from this host at
  `http://100.74.225.115:30500/v2/`.
