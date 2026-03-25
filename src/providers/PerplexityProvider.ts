import { IAIProvider } from './interfaces/IAIProvider';
import { ProviderResponse } from '../types/chat.types';
import { logger } from '../utils/logger';
import config from '../config';
import { InternalServerError, BadRequestError } from '../utils/errors';

/**
 * Error types for user-friendly messaging
 */
enum PerplexityErrorType {
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  INVALID_REQUEST = 'invalid_request',
  OVERLOADED = 'overloaded',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<PerplexityErrorType, string> = {
  [PerplexityErrorType.AUTHENTICATION]: 'Perplexity API key is invalid or missing. Please check your configuration.',
  [PerplexityErrorType.RATE_LIMIT]: 'Perplexity rate limit exceeded. Please try again in a moment.',
  [PerplexityErrorType.TIMEOUT]: 'Perplexity request timed out. Please try again.',
  [PerplexityErrorType.INVALID_REQUEST]: 'Invalid request to Perplexity. Please check your message.',
  [PerplexityErrorType.OVERLOADED]: 'Perplexity is currently overloaded. Please try again shortly.',
  [PerplexityErrorType.NETWORK]: 'Network error connecting to Perplexity. Please check your connection.',
  [PerplexityErrorType.UNKNOWN]: 'An unexpected error occurred with Perplexity. Please try again.',
};

/**
 * Perplexity API Response Types
 */
interface PerplexityMessage {
  role: string;
  content: string;
}

interface PerplexityChoice {
  index: number;
  finish_reason: string;
  message: PerplexityMessage;
}

interface PerplexityUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  choices: PerplexityChoice[];
  usage: PerplexityUsage;
}

/**
 * Perplexity Provider Implementation
 * Uses REST API with retry logic, timeout, and error mapping
 * Perplexity provides search-augmented AI responses
 */
export class PerplexityProvider implements IAIProvider {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly apiUrl = 'https://api.perplexity.ai/chat/completions';

  constructor() {
    this.apiKey = config.perplexity.apiKey;
    this.model = config.perplexity.model;
    this.timeout = config.perplexity.timeout;
    this.maxRetries = config.perplexity.maxRetries;
  }

  /**
   * Check if Perplexity is available for the user
   */
  async isAvailable(userId: string): Promise<boolean> {
    const available = !!this.apiKey;
    
    logger.debug(`Perplexity availability check for user ${userId}: ${available}`);
    return available;
  }

  /**
   * Map HTTP errors to user-friendly error types
   */
  private mapError(error: unknown, statusCode?: number): PerplexityErrorType {
    if (statusCode) {
      // Authentication errors
      if (statusCode === 401 || statusCode === 403) {
        return PerplexityErrorType.AUTHENTICATION;
      }
      
      // Rate limit errors
      if (statusCode === 429) {
        return PerplexityErrorType.RATE_LIMIT;
      }
      
      // Invalid request
      if (statusCode === 400) {
        return PerplexityErrorType.INVALID_REQUEST;
      }
      
      // Overloaded
      if (statusCode === 503 || statusCode === 529) {
        return PerplexityErrorType.OVERLOADED;
      }
    }
    
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Timeout
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        return PerplexityErrorType.TIMEOUT;
      }
      
      // Network errors
      if (errorMessage.includes('econnrefused') || 
          errorMessage.includes('enotfound') || 
          errorMessage.includes('network')) {
        return PerplexityErrorType.NETWORK;
      }
    }
    
    return PerplexityErrorType.UNKNOWN;
  }

  /**
   * Generate response from Perplexity with retry logic
   */
  async generateResponse(message: string, userId: string): Promise<ProviderResponse> {
    if (!this.apiKey) {
      throw new InternalServerError(ERROR_MESSAGES[PerplexityErrorType.AUTHENTICATION]);
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError: unknown;
    let lastStatusCode: number | undefined;

    // Retry loop
    while (attempt <= this.maxRetries) {
      try {
        logger.debug(`Perplexity request attempt ${attempt + 1}/${this.maxRetries + 1}`, {
          userId,
          model: this.model,
          messageLength: message.length,
        });

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
          const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.model,
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful AI assistant with access to real-time information. Provide clear, concise, and accurate responses.',
                },
                {
                  role: 'user',
                  content: message,
                },
              ],
              temperature: 0.7,
              max_tokens: 2000,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          lastStatusCode = response.status;

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
          }

          const data = await response.json() as PerplexityResponse;
          const latency = Date.now() - startTime;
          
          const responseText = data.choices[0]?.message?.content || '';
          const tokensUsed = data.usage?.total_tokens || 0;
          const promptTokens = data.usage?.prompt_tokens || 0;
          const completionTokens = data.usage?.completion_tokens || 0;

          // Log successful response
          logger.info('Perplexity response generated successfully', {
            userId,
            model: this.model,
            latency: `${latency}ms`,
            tokensUsed,
            promptTokens,
            completionTokens,
            attempt: attempt + 1,
          });

          // Return clean text (no metadata)
          return {
            text: responseText.trim(),
            provider: 'perplexity',
            model: this.model,
            tokensUsed,
          };

        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          // Handle abort as timeout error
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            throw new Error('Request timed out');
          }
          
          throw fetchError;
        }

      } catch (error) {
        lastError = error;
        attempt++;

        const errorType = this.mapError(error, lastStatusCode);
        const errorMessage = ERROR_MESSAGES[errorType];
        const latency = Date.now() - startTime;

        logger.error(`Perplexity request failed (attempt ${attempt}/${this.maxRetries + 1})`, {
          userId,
          model: this.model,
          errorType,
          error: error instanceof Error ? error.message : 'Unknown error',
          statusCode: lastStatusCode,
          latency: `${latency}ms`,
        });

        // Don't retry on authentication or invalid request errors
        if (errorType === PerplexityErrorType.AUTHENTICATION || 
            errorType === PerplexityErrorType.INVALID_REQUEST) {
          throw new BadRequestError(errorMessage);
        }

        // If we've exhausted retries, throw error
        if (attempt > this.maxRetries) {
          throw new InternalServerError(errorMessage);
        }

        // Wait before retry with exponential backoff
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        logger.debug(`Retrying after ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // Fallback error if somehow we exit the loop
    const errorType = this.mapError(lastError, lastStatusCode);
    throw new InternalServerError(ERROR_MESSAGES[errorType]);
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'perplexity';
  }
}
