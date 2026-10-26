# Filfilu HMS — Express app + landing static files
# Build from repo root:
#   docker build -f backend/Dockerfile -t filfilu-hms .
# Run (needs DATABASE_URL / JWT_SECRET / CORS_ORIGIN via env or --env-file):
#   docker run --rm -p 8080:8080 --env-file backend/.env filfilu-hms

FROM node:22-alpine AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/ ./
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN addgroup -S filfilu && adduser -S filfilu -G filfilu

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/prisma ./backend/prisma
COPY landing ./landing

USER filfilu
WORKDIR /app/backend
EXPOSE 8080

# Apply migrations then start (requires DATABASE_URL).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
