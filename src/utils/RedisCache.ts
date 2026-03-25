import Redis from 'ioredis';
import { logger } from './logger';

/**
 * Redis-based cache implementation for production use
 * Enables horizontal scaling across multiple instances
 * 
 * Benefits vs in-memory cache:
 * ✅ Shared state across multiple servers
 * ✅ Persistent storage (survives restarts)
 * ✅ Built-in TTL management
 * ✅ High performance (in-memory data store)
 * ✅ Clustering support
 */
export class RedisCache {
  private client: Redis;
  private isConnected = false;
  private readonly keyPrefix: string;

  constructor(options?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
  }) {
    const {
      host = process.env['REDIS_HOST'] || 'localhost',
      port = parseInt(process.env['REDIS_PORT'] || '6379', 10),
      password = process.env['REDIS_PASSWORD'],
      db = parseInt(process.env['REDIS_DB'] || '0', 10),
      keyPrefix = 'neurodrive:',
    } = options || {};

    this.keyPrefix = keyPrefix;

    this.client = new Redis({
      host,
      port,
      password,
      db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      showFriendlyErrorStack: process.env['NODE_ENV'] !== 'production',
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis: Connection established');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      logger.info('Redis: Ready to accept commands');
    });

    this.client.on('error', (error) => {
      logger.error('Redis error:', { error: error.message });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis: Connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis: Reconnecting...');
    });
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.client.get(fullKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis GET error:', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      const fullKey = this.keyPrefix + key;
      const serialized = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setex(fullKey, ttlSeconds, serialized);
      } else {
        await this.client.set(fullKey, serialized);
      }

      return true;
    } catch (error) {
      logger.error('Redis SET error:', { key, error });
      return false;
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.keyPrefix + key;
      await this.client.del(fullKey);
      return true;
    } catch (error) {
      logger.error('Redis DELETE error:', { key, error });
      return false;
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.keyPrefix + pattern;
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.client.del(...keys);
      return deleted;
    } catch (error) {
      logger.error('Redis DELETE PATTERN error:', { pattern, error });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error });
      return false;
    }
  }

  /**
   * Increment value (atomic operation)
   */
  async increment(key: string, amount = 1): Promise<number> {
    try {
      const fullKey = this.keyPrefix + key;
      return await this.client.incrby(fullKey, amount);
    } catch (error) {
      logger.error('Redis INCREMENT error:', { key, error });
      return 0;
    }
  }

  /**
   * Set expiration on existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const fullKey = this.keyPrefix + key;
      const result = await this.client.expire(fullKey, ttlSeconds);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXPIRE error:', { key, error });
      return false;
    }
  }

  /**
   * Get remaining TTL for key
   */
  async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.keyPrefix + key;
      return await this.client.ttl(fullKey);
    } catch (error) {
      logger.error('Redis TTL error:', { key, error });
      return -1;
    }
  }

  /**
   * Check if Redis is connected and healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (error) {
      logger.error('Redis health check failed:', { error });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    keysCount: number;
    memoryUsed?: string;
  }> {
    try {
      const keysCount = await this.client.dbsize();
      const info = await this.client.info('memory');
      
      // Parse used_memory from info string
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1] : undefined;

      return {
        connected: this.isConnected,
        keysCount,
        memoryUsed,
      };
    } catch (error) {
      logger.error('Redis STATS error:', { error });
      return {
        connected: false,
        keysCount: 0,
      };
    }
  }

  /**
   * Flush all keys with prefix (use with caution!)
   */
  async flush(): Promise<boolean> {
    try {
      const keys = await this.client.keys(this.keyPrefix + '*');
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      logger.warn('Redis cache flushed', { keysDeleted: keys.length });
      return true;
    } catch (error) {
      logger.error('Redis FLUSH error:', { error });
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async destroy(): Promise<void> {
    try {
      await this.client.quit();
      logger.info('Redis connection closed gracefully');
    } catch (error) {
      logger.error('Redis DESTROY error:', { error });
      this.client.disconnect();
    }
  }

  /**
   * Get raw Redis client for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }
}
