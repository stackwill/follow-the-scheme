type LoginFailure = {
  count: number;
  lockedUntil: number;
  lastFailureAt: number;
};

const failures = new Map<string, LoginFailure>();
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_AFTER_FAILURES = 5;
const BASE_LOCKOUT_MS = 30 * 1000;
const MAX_LOCKOUT_MS = 15 * 60 * 1000;

function currentFailure(key: string, now: number) {
  const failure = failures.get(key);

  if (!failure) {
    return null;
  }

  if (now - failure.lastFailureAt > WINDOW_MS && now >= failure.lockedUntil) {
    failures.delete(key);
    return null;
  }

  return failure;
}

export function loginRetryAfterSeconds(key: string, now = Date.now()) {
  const failure = currentFailure(key, now);

  if (!failure || now >= failure.lockedUntil) {
    return 0;
  }

  return Math.ceil((failure.lockedUntil - now) / 1000);
}

export function recordFailedLogin(key: string, now = Date.now()) {
  const failure = currentFailure(key, now);
  const count = (failure?.count ?? 0) + 1;
  const lockoutMultiplier = Math.max(0, count - LOCKOUT_AFTER_FAILURES);
  const lockoutMs =
    count >= LOCKOUT_AFTER_FAILURES ? Math.min(BASE_LOCKOUT_MS * 2 ** lockoutMultiplier, MAX_LOCKOUT_MS) : 0;

  failures.set(key, {
    count,
    lockedUntil: now + lockoutMs,
    lastFailureAt: now,
  });

  return Math.ceil(lockoutMs / 1000);
}

export function clearFailedLogins(key: string) {
  failures.delete(key);
}
