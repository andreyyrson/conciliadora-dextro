interface RateLimitEntry {
  count: number
  resetAt: number
}

const cache = new Map<string, RateLimitEntry>()

export function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = cache.get(identifier)

  if (!entry || now > entry.resetAt) {
    // Nova janela
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    }
    cache.set(identifier, newEntry)
    return { success: true, remaining: limit - 1, resetAt: newEntry.resetAt }
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count += 1
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

export function getRateLimitHeaders(
  limit: number,
  remaining: number,
  resetAt: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  }
}
