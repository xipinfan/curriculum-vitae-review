FROM node:22-alpine AS deps

RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --filter @cv-review/api... --frozen-lockfile

FROM deps AS build

COPY apps/api/src apps/api/src
COPY apps/api/prisma apps/api/prisma
COPY apps/api/nest-cli.json apps/api/nest-cli.json
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/api/tsconfig.build.json apps/api/tsconfig.build.json

RUN pnpm --filter @cv-review/api prisma:generate
RUN pnpm --filter @cv-review/api build

FROM node:22-alpine AS runtime

RUN corepack enable
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["sh", "-c", "pnpm --filter @cv-review/api prisma:migrate:deploy && node apps/api/dist/main.js"]
