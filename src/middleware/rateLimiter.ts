import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { logger } from '../utils/logger';
import config from '../config';

/**
 * Redis Rate Limiter
 * 
 * Production-grade rate limiting with Redis backend:
 * - Shared state across multiple server instances
 * - Persistent rate limits (survive server restarts)
 * - Better performance than in-memory store
 * 
 * Rate Limiting Tiers:
 * - Anonymous: 10 req/min
 * - Authenticated: 100 req/min
 * - Premium: 1000 req/min
 */

/**
 * Create Redis client for rate limiting
 */
const createRedisClient = () => {
  const client = createClient({
    socket: {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379'),
    },
    password: process.env['REDIS_PASSWORD'],
    database: parseInt(process.env['REDIS_DB'] || '0'),
  });

  client.on('error', (err: any) => {
    logger.error('Redis rate limiter client error', { error: err?.message });
  });

  client.on('connect', () => {
    logger.info('Redis rate limiter connected');
  });

  return client;
};

// Redis client for rate limiting
let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Initialize Redis client
 */
const initRedisClient = async () => {
  if (!redisClient) {
    redisClient = createRedisClient();
    await redisClient.connect();
  }
  return redisClient;
};

/**
 * Global rate limiter - applies to all requests
 */
import { Request } from 'express';
export const globalRateLimiter = async () => {
  const client = await initRedisClient();

  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    store: new RedisStore({
      // @ts-expect-error - Type mismatch between redis and rate-limit-redis
      client,
      prefix: 'neurodrive:ratelimit:global:',
    }),
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 900, // 15 minutes in seconds
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/metrics';
    },
    keyGenerator: (req: Request) => {
      // Use IP address as key
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
  });
};

/**
 * API rate limiter - applies to API routes
 * Tiered based on authentication status
 */
export const apiRateLimiter = async () => {
  const client = await initRedisClient();

  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: async (req: Request) => {
      // Dynamic limit based on user tier
      const user = (req as any).user;
      
      if (!user) {
        return 10; // Anonymous: 10 req/min
      }
      
      if (user.role === 'premium') {
        return 1000; // Premium: 1000 req/min
      }
      
      return 100; // Authenticated: 100 req/min
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // @ts-expect-error - Type mismatch
      client,
      prefix: 'neurodrive:ratelimit:api:',
    }),
    message: async (req: Request) => {
      const user = (req as any).user;
      const tier = !user ? 'anonymous' : user.role === 'premium' ? 'premium' : 'authenticated';
      const limit = !user ? 10 : user.role === 'premium' ? 1000 : 100;
      
      return {
        error: `Rate limit exceeded for ${tier} tier (${limit} requests per minute)`,
        tier,
        limit,
        retryAfter: 60,
      };
    },
    keyGenerator: (req: Request) => {
      // Use userId if authenticated, otherwise IP
      const user = (req as any).user;
      if (user) {
        return `user:${user.userId}`;
      }
      return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    },
  });
};

/**
 * Chat/LLM request rate limiter
 * Stricter limits for expensive AI operations
 */
export const chatRateLimiter = async () => {
  const client = await initRedisClient();

  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: async (req: Request) => {
      const user = (req as any).user;
      
      if (!user) {
        return 5; // Anonymous: 5 chat requests/min
      }
      
      if (user.role === 'premium') {
        return 100; // Premium: 100 chat requests/min
      }
      
      return 20; // Authenticated: 20 chat requests/min
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // @ts-expect-error - Type mismatch
      client,
      prefix: 'neurodrive:ratelimit:chat:',
    }),
    message: async (req: Request) => {
      const user = (req as any).user;
      const tier = !user ? 'anonymous' : user.role === 'premium' ? 'premium' : 'authenticated';
      const limit = !user ? 5 : user.role === 'premium' ? 100 : 20;
      
      return {
        error: `Chat rate limit exceeded for ${tier} tier (${limit} requests per minute)`,
        tier,
        limit,
        retryAfter: 60,
        suggestion: tier === 'anonymous' ? 'Sign in for higher limits' : 'Upgrade to premium for more requests',
      };
    },
    keyGenerator: (req: Request) => {
      const user = (req as any).user;
      if (user) {
        return `user:${user.userId}`;
      }
      return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    },
  });
};

/**
 * Shutdown Redis client gracefully
 */
export const shutdownRateLimiter = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis rate limiter shutdown complete');
  }
};

// Cleanup on process termination
process.on('SIGTERM', shutdownRateLimiter);
process.on('SIGINT', shutdownRateLimiter);
