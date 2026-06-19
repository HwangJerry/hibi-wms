# syntax=docker/dockerfile:1
FROM node:20.19.3-alpine AS build
WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/realtime/package.json ./apps/realtime/
COPY apps/web/package.json ./apps/web/
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
ENV DATABASE_URL=postgresql://hibi:hibi@127.0.0.1:5432/hibi_portal
RUN pnpm exec turbo run build --filter @hibi/realtime

FROM node:20.19.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages

USER node
EXPOSE 3001
CMD ["node", "apps/realtime/dist/index.js"]
