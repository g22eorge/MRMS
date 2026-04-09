interface RateLimitResult {
  success: boolean;
  remaining?: number;
  resetAt?: number;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function cleanupStore(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

export async function rateLimit(
  identifier: string,
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  cleanupStore();
  
  const fullKey = `${key}:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  const current = rateLimitStore.get(fullKey);
  
  if (!current) {
    rateLimitStore.set(fullKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }
  
  if (now > current.resetAt) {
    rateLimitStore.set(fullKey, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      remaining: maxRequests - 1,
      resetAt: now + windowMs,
    };
  }
  
  if (current.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }
  
  current.count++;
  return {
    success: true,
    remaining: maxRequests - current.count,
    resetAt: current.resetAt,
  };
}