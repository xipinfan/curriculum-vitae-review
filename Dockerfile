FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY apps/web apps/web

RUN pnpm --filter @cv-review/api prisma:generate
RUN pnpm --filter @cv-review/api build
RUN pnpm --filter @cv-review/web build

FROM node:22-alpine AS runtime

RUN corepack enable \
  && apk add --no-cache nginx

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY deploy/huggingface/nginx.conf /etc/nginx/http.d/default.conf
COPY deploy/huggingface/start.sh /app/start.sh

RUN chmod +x /app/start.sh

ENV NODE_ENV=production
ENV PORT=3001
ENV HF_SPACE_PORT=7860

EXPOSE 7860

CMD ["/app/start.sh"]
