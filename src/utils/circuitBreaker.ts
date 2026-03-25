import CircuitBreaker from 'opossum';
import { logger } from '../utils/logger';

/**
 * Circuit Breaker configuration options
 */
export interface CircuitBreakerOptions {
  timeout?: number; // Request timeout in ms (default: 10000)
  errorThresholdPercentage?: number; // Error % to open circuit (default: 50)
  resetTimeout?: number; // Time before retry in ms (default: 30000)
  volumeThreshold?: number; // Min requests before calculating error rate (default: 10)
  name?: string; // Circuit breaker name for logging
}

/**
 * Circuit Breaker Manager
 * 
 * Prevents cascading failures by:
 * 1. Fast-failing when a service is down
 * 2. Giving the service time to recover
 * 3. Automatically retrying after cool-down period
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service failing, reject requests immediately
 * - HALF_OPEN: Testing if service recovered
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Create or get circuit breaker for a service
   */
  getBreaker<T, Args extends unknown[]>(
    name: string,
    fn: (...args: Args) => Promise<T>,
    options: CircuitBreakerOptions = {}
  ): CircuitBreaker<Args, T> {
    const existing = this.breakers.get(name);
    if (existing) {
      return existing as CircuitBreaker<Args, T>;
    }

    const {
      timeout = 10000,
      errorThresholdPercentage = 50,
      resetTimeout = 30000,
      volumeThreshold = 10,
    } = options;

    const breaker = new CircuitBreaker(fn, {
      timeout,
      errorThresholdPercentage,
      resetTimeout,
      volumeThreshold,
      name,
    });

    this.setupEventHandlers(breaker, name);
    this.breakers.set(name, breaker as unknown as CircuitBreaker);

    logger.info(`Circuit breaker created: ${name}`, {
      timeout,
      errorThresholdPercentage,
      resetTimeout,
    });

    return breaker;
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(breaker: CircuitBreaker, name: string): void {
    breaker.on('open', () => {
      logger.warn(`Circuit breaker OPEN: ${name} - Requests will fail fast`);
    });

    breaker.on('halfOpen', () => {
      logger.info(`Circuit breaker HALF OPEN: ${name} - Testing recovery`);
    });

    breaker.on('close', () => {
      logger.info(`Circuit breaker CLOSED: ${name} - Normal operation resumed`);
    });

    breaker.on('success', (result) => {
      logger.debug(`Circuit breaker success: ${name}`);
    });

    breaker.on('failure', (error) => {
      logger.warn(`Circuit breaker failure: ${name}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    breaker.on('timeout', () => {
      logger.warn(`Circuit breaker timeout: ${name}`);
    });

    breaker.on('reject', () => {
      logger.warn(`Circuit breaker REJECT: ${name} - Circuit is open`);
    });
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(name: string): CircuitBreakerStats | null {
    const breaker = this.breakers.get(name);
    if (!breaker) {
      return null;
    }

    const stats = breaker.stats;
    
    return {
      name,
      state: this.getState(breaker),
      failures: stats.failures,
      successes: stats.successes,
      rejects: stats.rejects,
      timeouts: stats.timeouts,
      fires: stats.fires,
      totalRequests: stats.fires,
      errorRate: stats.fires > 0 ? (stats.failures / stats.fires) * 100 : 0,
    };
  }

  /**
   * Get current state of circuit breaker
   */
  private getState(breaker: CircuitBreaker): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    if (breaker.opened) return 'OPEN';
    if (breaker.halfOpen) return 'HALF_OPEN';
    return 'CLOSED';
  }

  /**
   * Get all circuit breaker names
   */
  getBreakerNames(): string[] {
    return Array.from(this.breakers.keys());
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): CircuitBreakerStats[] {
    return this.getBreakerNames()
      .map((name) => this.getStats(name))
      .filter((stats): stats is CircuitBreakerStats => stats !== null);
  }

  /**
   * Manually open a circuit breaker
   */
  open(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.open();
      logger.warn(`Circuit breaker manually opened: ${name}`);
    }
  }

  /**
   * Manually close a circuit breaker
   */
  close(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.close();
      logger.info(`Circuit breaker manually closed: ${name}`);
    }
  }

  /**
   * Clear all circuit breakers
   */
  clear(): void {
    this.breakers.clear();
    logger.info('All circuit breakers cleared');
  }

  /**
   * Shutdown all circuit breakers
   */
  shutdown(): void {
    this.breakers.forEach((breaker, name) => {
      breaker.shutdown();
      logger.debug(`Circuit breaker shutdown: ${name}`);
    });
    this.breakers.clear();
  }
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  rejects: number;
  timeouts: number;
  fires: number;
  totalRequests: number;
  errorRate: number;
}

// Singleton instance
export const circuitBreakerManager = new CircuitBreakerManager();
