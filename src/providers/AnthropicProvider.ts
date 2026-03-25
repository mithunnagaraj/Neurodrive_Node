import Anthropic from '@anthropic-ai/sdk';
import { IAIProvider } from './interfaces/IAIProvider';
import { ProviderResponse } from '../types/chat.types';
import { logger } from '../utils/logger';
import config from '../config';
import { InternalServerError, BadRequestError } from '../utils/errors';

/**
 * Error types for user-friendly messaging
 */
enum AnthropicErrorType {
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
const ERROR_MESSAGES: Record<AnthropicErrorType, string> = {
  [AnthropicErrorType.AUTHENTICATION]: 'Anthropic API key is invalid or missing. Please check your configuration.',
  [AnthropicErrorType.RATE_LIMIT]: 'Anthropic rate limit exceeded. Please try again in a moment.',
  [AnthropicErrorType.TIMEOUT]: 'Anthropic request timed out. Please try again.',
  [AnthropicErrorType.INVALID_REQUEST]: 'Invalid request to Anthropic. Please check your message.',
  [AnthropicErrorType.OVERLOADED]: 'Anthropic is currently overloaded. Please try again shortly.',
  [AnthropicErrorType.NETWORK]: 'Network error connecting to Anthropic. Please check your connection.',
  [AnthropicErrorType.UNKNOWN]: 'An unexpected error occurred with Anthropic. Please try again.',
};

/**
 * Anthropic Provider Implementation
 * Uses official Anthropic SDK with retry logic, timeout, and error mapping
 */
export class AnthropicProvider implements IAIProvider {
  private client: Anthropic | null = null;
  private readonly model: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor() {
    this.model = config.anthropic.model;
    this.timeout = config.anthropic.timeout;
    this.maxRetries = config.anthropic.maxRetries;
  }

  /**
   * Initialize Anthropic client if API key is available
   */
  private initializeClient(): void {
    if (!config.anthropic.apiKey) {
      return;
    }

    if (!this.client) {
      this.client = new Anthropic({
        apiKey: config.anthropic.apiKey,
        timeout: this.timeout,
        maxRetries: this.maxRetries,
      });
      logger.debug('Anthropic client initialized', {
        model: this.model,
        timeout: this.timeout,
        maxRetries: this.maxRetries,
      });
    }
  }

  /**
   * Check if Anthropic is available for the user
   */
  async isAvailable(userId: string): Promise<boolean> {
    // For BYOK model, check if user has configured their own key
    // For now, use global configuration
    const available = !!config.anthropic.apiKey;
    
    logger.debug(`Anthropic availability check for user ${userId}: ${available}`);
    return available;
  }

  /**
   * Map Anthropic errors to user-friendly error types
   */
  private mapError(error: unknown): AnthropicErrorType {
    if (error instanceof Anthropic.APIError) {
      // Authentication errors
      if (error.status === 401 || error.status === 403) {
        return AnthropicErrorType.AUTHENTICATION;
      }
      
      // Rate limit errors
      if (error.status === 429) {
        return AnthropicErrorType.RATE_LIMIT;
      }
      
      // Invalid request
      if (error.status === 400) {
        return AnthropicErrorType.INVALID_REQUEST;
      }
      
      // Overloaded
      if (error.status === 529 || error.status === 503) {
        return AnthropicErrorType.OVERLOADED;
      }
      
      // Network timeout
      if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        return AnthropicErrorType.TIMEOUT;
      }
    }
    
    // Network errors
    if (error instanceof Error && (
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('network')
    )) {
      return AnthropicErrorType.NETWORK;
    }
    
    return AnthropicErrorType.UNKNOWN;
  }

  /**
   * Generate response from Anthropic with retry logic
   */
  async generateResponse(message: string, userId: string): Promise<ProviderResponse> {
    this.initializeClient();

    if (!this.client) {
      throw new InternalServerError(ERROR_MESSAGES[AnthropicErrorType.AUTHENTICATION]);
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError: unknown;

    // Retry loop
    while (attempt <= this.maxRetries) {
      try {
        logger.debug(`Anthropic request attempt ${attempt + 1}/${this.maxRetries + 1}`, {
          userId,
          model: this.model,
          messageLength: message.length,
        });

        const completion = await this.client.messages.create({
          model: this.model,
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: message,
            },
          ],
          system: 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.',
        });

        const latency = Date.now() - startTime;
        
        // Extract text from response
        const responseText = completion.content
          .filter((block) => block.type === 'text')
          .map((block) => ('text' in block ? block.text : ''))
          .join('\n');

        // Token usage from Anthropic API
        const tokensUsed = (completion.usage?.input_tokens || 0) + (completion.usage?.output_tokens || 0);
        const promptTokens = completion.usage?.input_tokens || 0;
        const completionTokens = completion.usage?.output_tokens || 0;

        // Log successful response
        logger.info('Anthropic response generated successfully', {
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
          provider: 'anthropic',
          model: this.model,
          tokensUsed,
        };

      } catch (error) {
        lastError = error;
        attempt++;

        const errorType = this.mapError(error);
        const errorMessage = ERROR_MESSAGES[errorType];
        const latency = Date.now() - startTime;

        logger.error(`Anthropic request failed (attempt ${attempt}/${this.maxRetries + 1})`, {
          userId,
          model: this.model,
          errorType,
          error: error instanceof Error ? error.message : 'Unknown error',
          latency: `${latency}ms`,
        });

        // Don't retry on authentication or invalid request errors
        if (errorType === AnthropicErrorType.AUTHENTICATION || 
            errorType === AnthropicErrorType.INVALID_REQUEST) {
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
    const errorType = this.mapError(lastError);
    throw new InternalServerError(ERROR_MESSAGES[errorType]);
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return 'anthropic';
  }
}
