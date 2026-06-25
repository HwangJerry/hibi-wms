# syntax=docker/dockerfile:1
FROM node:20.19.3-alpine AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY apps/realtime/package.json ./apps/realtime/
COPY packages/api/package.json ./packages/api/
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config/package.json ./packages/config/
COPY packages/ui/package.json ./packages/ui/
RUN pnpm install --frozen-lockfile

COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY tsconfig.json ./
COPY turbo.json ./
RUN pnpm --filter @hibi/web build

FROM nginxinc/nginx-unprivileged:1.29.0-alpine AS runtime
WORKDIR /usr/share/nginx/html

COPY --from=build /app/apps/web/dist .
RUN rm -f /etc/nginx/conf.d/default.conf
RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
  listen 8080;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF

EXPOSE 8080
