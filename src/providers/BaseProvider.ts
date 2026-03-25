import { IAIProvider } from './interfaces/IAIProvider';
import { ProviderResponse } from '../types/chat.types';
import { logger } from '../utils/logger';

/**
 * Retry configuration shared across all providers
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  timeoutMs: number;
}

/**
 * Abstract base class for AI providers
 * Implements shared retry logic, error handling patterns
 * 
 * Benefits:
 * - DRY: Retry logic written once, used by all providers
 * - Consistency: All providers behave the same way
 * - Testability: Retry logic can be tested independently
 * - Maintainability: Changes to retry strategy apply everywhere
 */
export abstract class BaseProvider implements IAIProvider {
  protected readonly retryConfig: RetryConfig;
  protected readonly providerName: string;

  constructor(providerName: string, retryConfig: RetryConfig) {
    this.providerName = providerName;
    this.retryConfig = retryConfig;
  }

  /**
   * Template method: calls protected abstract method with retry logic
   */
  async generateResponse(message: string, userId: string): Promise<ProviderResponse> {
    return this.executeWithRetry(
      () => this.generateResponseInternal(message, userId),
      userId,
      message.length
    );
  }

  /**
   * Shared retry logic with exponential backoff
   * Implements the retry pattern used by all providers
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    userId: string,
    messageLength?: number
  ): Promise<T> {
    const maxAttempts = this.retryConfig.maxRetries + 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startTime = Date.now();

      try {
        logger.debug(`${this.providerName} request attempt ${attempt}/${maxAttempts}`, {
          userId,
          messageLength,
        });

        const result = await operation();

        const latency = Date.now() - startTime;
        logger.info(`${this.providerName} response generated successfully`, {
          userId,
          latency: `${latency}ms`,
          attempt,
        });

        return result;
      } catch (error) {
        lastError = error as Error;
        const latency = Date.now() - startTime;

        logger.error(`${this.providerName} request failed (attempt ${attempt}/${maxAttempts})`, {
          userId,
          errorType: this.classifyError(error),
          error: error instanceof Error ? error.message : 'Unknown error',
          latency: `${latency}ms`,
        });

        // Don't retry on last attempt
        if (attempt === maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateBackoffDelay(attempt);
        logger.debug(`Retrying after ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    throw this.createFinalError(lastError);
  }

  /**
   * Calculate exponential backoff delay
   * delay = min(initialDelay * 2^(attempt-1), maxDelay)
   */
  protected calculateBackoffDelay(attempt: number): number {
    const exponentialDelay =
      this.retryConfig.initialDelayMs * Math.pow(2, attempt - 1);
    return Math.min(exponentialDelay, this.retryConfig.maxDelayMs);
  }

  /**
   * Sleep utility for retry delays
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Classify errors for better logging and metrics
   */
  protected classifyError(error: unknown): string {
    if (!error) return 'unknown';

    const err = error as Error & { code?: string; status?: number };

    // Network errors
    if (err.code === 'ECONNREFUSED') return 'connection_refused';
    if (err.code === 'ETIMEDOUT') return 'timeout';
    if (err.code === 'ENOTFOUND') return 'dns_error';

    // HTTP errors
    if (err.status === 429) return 'rate_limit';
    if (err.status === 401) return 'unauthorized';
    if (err.status === 403) return 'forbidden';
    if (err.status === 404) return 'not_found';
    if (err.status && err.status >= 500) return 'server_error';

    // Generic
    if (err.message?.includes('timeout')) return 'timeout';
    if (err.message?.includes('aborted')) return 'request_aborted';

    return 'api_error';
  }

  /**
   * Create final error after all retries exhausted
   */
  protected createFinalError(lastError?: Error): Error {
    const message = `${this.providerName} request failed after ${this.retryConfig.maxRetries} retries`;
    const error = new Error(
      lastError ? `${message}: ${lastError.message}` : message
    );
    
    // Preserve stack trace
    if (lastError?.stack) {
      error.stack = lastError.stack;
    }
    
    return error;
  }

  /**
   * Abstract methods that concrete providers must implement
   */
  abstract generateResponseInternal(
    message: string,
    userId: string
  ): Promise<ProviderResponse>;

  abstract isAvailable(userId: string): Promise<boolean>;

  getProviderName(): string {
    return this.providerName;
  }
}
