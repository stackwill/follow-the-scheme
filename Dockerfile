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
COPY --from=builder /app ./
EXPOSE 3000
CMD ["bun", "run", "start"]
