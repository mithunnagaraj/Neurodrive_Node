import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/errors';

/**
 * Request Timeout Middleware
 * Ensures requests don't hang indefinitely
 * 
 * Prevents:
 * - Resource exhaustion from stuck requests
 * - Poor user experience from hung connections
 * - Cascading failures in distributed systems
 */

export interface TimeoutOptions {
  /**
   * Timeout duration in milliseconds
   * Default: 30000 (30 seconds)
   */
  timeout?: number;
  
  /**
   * Custom error message
   */
  message?: string;
}

/**
 * Create timeout middleware with configurable options
 */
export const requestTimeout = (options: TimeoutOptions = {}) => {
  const timeout = options.timeout || 30000; // 30 seconds default
  const message = options.message || 'Request timeout';

  return (_req: Request, res: Response, next: NextFunction): void => {
    // Set timeout on the request
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        // Request timed out before response was sent
        const error = new BadRequestError(
          `${message} - Request exceeded ${timeout}ms limit`
        );
        error.statusCode = 408; // Request Timeout
        next(error);
      }
    }, timeout);

    // Clear timeout when response finishes
    res.on('finish', () => {
      clearTimeout(timeoutId);
    });

    // Clear timeout on error
    res.on('close', () => {
      clearTimeout(timeoutId);
    });

    next();
  };
};

/**
 * Pre-configured timeout middleware for different scenarios
 */
export const timeoutMiddleware = {
  /**
   * Standard timeout for API requests (30s)
   */
  standard: requestTimeout({ timeout: 30000 }),

  /**
   * Long timeout for AI provider requests (60s)
   */
  long: requestTimeout({ timeout: 60000 }),

  /**
   * Short timeout for health checks (5s)
   */
  short: requestTimeout({ timeout: 5000 }),
};
