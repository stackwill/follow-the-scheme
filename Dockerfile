FROM oven/bun:1.2 AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["bun", "run", "start"]
