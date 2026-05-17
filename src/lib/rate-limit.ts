type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  maxRequests: number;
  windowMs: number;
};

export type RateLimitResult =
  | {
      allowed: true;
      remaining: number;
      resetAt: number;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
      resetAt: number;
    };

const DEFAULT_MAX_REQUESTS = Number(process.env.MARK_RATE_LIMIT_MAX ?? 30);
const DEFAULT_WINDOW_MS = Number(process.env.MARK_RATE_LIMIT_WINDOW_SECONDS ?? 60 * 60) * 1000;
const buckets = new Map<string, RateLimitEntry>();

function nowMs() {
  return Date.now();
}

function cleanupExpiredEntries(now: number) {
  if (buckets.size < 1000) {
    return;
  }

  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {
    maxRequests: DEFAULT_MAX_REQUESTS,
    windowMs: DEFAULT_WINDOW_MS,
  },
  now = nowMs(),
): RateLimitResult {
  cleanupExpiredEntries(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt: now + options.windowMs,
    };
  }

  if (existing.count >= options.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    remaining: options.maxRequests - existing.count,
    resetAt: existing.resetAt,
  };
}

export function clientRateLimitKeyFromHeaders(headers: Pick<Headers, "get">) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip =
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    forwardedFor ??
    "unknown";

  return `mark:${ip}`;
}

export function rateLimitMessage(result: Extract<RateLimitResult, { allowed: false }>) {
  const minutes = Math.max(1, Math.ceil(result.retryAfterSeconds / 60));

  return `Too many marking requests. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
