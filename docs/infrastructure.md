# Infrastructure

## Cluster
- **k3s** across **two laptops**. Treat **node A** as the primary: control-plane +
  stateful workloads. **Node B** runs stateless replicas.
- Laptop hygiene: disable sleep / suspend-on-lid-close on both nodes; prefer wired
  networking; keep them on stable power.

## Public access — Cloudflare Tunnel
- Run **`cloudflared`** as a Deployment with **2 replicas** (one per node) so the tunnel
  survives a node reboot. The connection is **outbound** — no inbound ports, no router
  port-forwarding, no static public IP needed.
- TLS terminates at the **Cloudflare edge**. In-cluster traffic is plain HTTP. **No
  cert-manager.**
- Optionally put **Cloudflare Access** in front to restrict the whole app to the two
  partners at the edge (app still enforces its own sessions).

## Ingress — Traefik
- Use k3s's bundled **Traefik**. `cloudflared` routes hostnames to the Traefik Service;
  Traefik routes by host/path to: `web` (frontend), `api` (tRPC), `realtime` (Hocuspocus,
  WebSocket).

## Stateful data
- **PostgreSQL**: a single instance **pinned to node A** via `nodeAffinity`, backed by a
  **local-path** PVC. Not HA by design — protected by backups instead.
- **File attachments**: stored in **Cloudflare R2** (S3-compatible), not on cluster
  volumes. So the only thing on local disk that must be protected is Postgres.
- **Yjs doc state** lives in Postgres (so it's covered by DB backups).

## Backups
- A Kubernetes **CronJob** runs `pg_dump` to an **R2 bucket** on a schedule (e.g. hourly +
  daily), with retention. R2 object versioning adds a second layer.
- Periodically test restore into a scratch database — a backup you haven't restored is a
  guess.

## Topology summary
```
Internet → Cloudflare edge (Access + TLS)
         → cloudflared (2 replicas, outbound)
         → Traefik
         → web | api | realtime
                 api/realtime → PostgreSQL (node A, pinned)
                 attachments  → Cloudflare R2
backups: CronJob pg_dump → R2
```
