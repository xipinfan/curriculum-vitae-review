FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --filter @cv-review/web... --frozen-lockfile

COPY apps/web/src apps/web/src
COPY apps/web/index.html apps/web/index.html
COPY apps/web/tsconfig.json apps/web/tsconfig.json
COPY apps/web/vite.config.ts apps/web/vite.config.ts
COPY apps/web/vitest.config.ts apps/web/vitest.config.ts
COPY apps/web/nginx.conf apps/web/nginx.conf

RUN pnpm --filter @cv-review/web build

FROM nginx:1.27-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
