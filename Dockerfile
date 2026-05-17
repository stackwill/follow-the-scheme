FROM oven/bun:1.2 AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app
ENV DATABASE_URL="file:../data/app.db"
ENV APP_DATA_DIR="./data"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run db:generate
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
CMD ["bun", "server.js"]
