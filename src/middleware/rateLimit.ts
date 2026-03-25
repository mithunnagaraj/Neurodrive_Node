import { Request, Response, NextFunction } from 'express';
import config from '../config';

/**
 * Simple in-memory rate limiter
 * For production, use Redis-based solution (e.g., express-rate-limit with Redis store)
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }>;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.requests = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Cleanup old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request should be rate limited
   */
  public check(identifier: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetTime) {
      // New window
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return { allowed: true };
    }

    if (record.count >= this.maxRequests) {
      // Rate limit exceeded
      return { allowed: false, resetTime: record.resetTime };
    }

    // Increment count
    record.count++;
    return { allowed: true };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.requests.entries()) {
      if (now > record.resetTime) {
        this.requests.delete(key);
      }
    }
  }
}

// Create rate limiter instance
const rateLimiter = new RateLimiter(
  config.rateLimit.windowMs,
  config.rateLimit.maxRequests
);

/**
 * Rate limiting middleware
 * Limits requests per IP address
 */
export const rateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!config.rateLimit.enabled) {
    next();
    return;
  }

  const identifier = req.ip || 'unknown';
  const result = rateLimiter.check(identifier);

  if (!result.allowed) {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests, please try again later.',
      retryAfter: result.resetTime
        ? Math.ceil((result.resetTime - Date.now()) / 1000)
        : undefined,
    });
    return;
  }

  next();
};
