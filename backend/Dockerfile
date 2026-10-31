# Filfilu HMS — Express app + landing static files
# Build from repo root:
#   docker build -f backend/Dockerfile -t filfilu-hms .
# Run (needs DATABASE_URL / JWT_SECRET / CORS_ORIGIN via env or --env-file):
#   docker run --rm -p 8080:8080 --env-file backend/.env filfilu-hms
#
# Migrations use the Prisma CLI shipped in dependencies (not downloaded at runtime).

FROM node:22-alpine AS deps
WORKDIR /app/backend
RUN apk add --no-cache openssl libc6-compat
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app/backend
RUN apk add --no-cache openssl libc6-compat
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json backend/package-lock.json backend/tsconfig.json ./
COPY backend/prisma ./prisma
COPY backend/src ./src
RUN npx prisma generate && npm run build \
  && npm prune --omit=dev \
  && test -f node_modules/prisma/package.json \
  && test -d node_modules/@prisma/client

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN apk add --no-cache openssl libc6-compat wget \
  && addgroup -S filfilu && adduser -S filfilu -G filfilu

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma ./backend/prisma
COPY landing ./landing
COPY backend/docker/entrypoint.sh ./backend/docker/entrypoint.sh

RUN chmod +x ./backend/docker/entrypoint.sh \
  && chown -R filfilu:filfilu /app

USER filfilu
WORKDIR /app/backend
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["./docker/entrypoint.sh"]
