import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { IAIProvider } from './interfaces/IAIProvider';
import { ProviderResponse } from '../types/chat.types';
import { logger } from '../utils/logger';
import config from '../config';
import { InternalServerError, BadRequestError } from '../utils/errors';

/**
 * Error types for user-friendly messaging
 */
enum GeminiErrorType {
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  INVALID_REQUEST = 'invalid_request',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  NETWORK = 'network',
  SAFETY_FILTER = 'safety_filter',
  UNKNOWN = 'unknown',
}

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<GeminiErrorType, string> = {
  [GeminiErrorType.AUTHENTICATION]: 'Gemini API key is invalid or missing. Please check your configuration.',
  [GeminiErrorType.RATE_LIMIT]: 'Gemini rate limit exceeded. Please try again in a moment.',
  [GeminiErrorType.TIMEOUT]: 'Gemini request timed out. Please try again.',
  [GeminiErrorType.INVALID_REQUEST]: 'Invalid request to Gemini. Please check your message.',
  [GeminiErrorType.SERVICE_UNAVAILABLE]: 'Gemini is currently unavailable. Please try again shortly.',
  [GeminiErrorType.NETWORK]: 'Network error connecting to Gemini. Please check your connection.',
  [GeminiErrorType.SAFETY_FILTER]: 'Message blocked by Gemini safety filters. Please rephrase your message.',
  [GeminiErrorType.UNKNOWN]: 'An unexpected error occurred with Gemini. Please try again.',
};

/**
 * Gemini Provider Implementation
 * Uses official Google Generative AI SDK with retry logic, timeout, and error mapping
 */
export class GeminiProvider implements IAIProvider {
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private readonly modelName: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor() {
    this.modelName = config.gemini.model;
    this.timeout = config.gemini.timeout;
    this.maxRetries = config.gemini.maxRetries;
  }

  /**
   * Initialize Gemini client if API key is available
   */
  private initializeClient(): void {
    if (!config.gemini.apiKey) {
      return;
    }

    if (!this.client) {
      this.client = new GoogleGenerativeAI(config.gemini.apiKey);
      this.model = this.client.getGenerativeModel({ model: this.modelName });
      
      logger.debug('Gemini client initialized', {
        model: this.modelName,
        timeout: this.timeout,
        maxRetries: this.maxRetries,
      });
    }
  }

  /**
   * Check if Gemini is available for the user
   */
  async isAvailable(userId: string): Promise<boolean> {
    // For BYOK model, check if user has configured their own key
    // For now, use global configuration
    const available = !!config.gemini.apiKey;
    
    logger.debug(`Gemini availability check for user ${userId}: ${available}`);
    return available;
  }

  /**
   * Map Gemini errors to user-friendly error types
   */
  private mapError(error: unknown): GeminiErrorType {
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Authentication errors
      if (errorMessage.includes('api key') || 
          errorMessage.includes('authentication') ||
          errorMessage.includes('unauthorized')) {
        return GeminiErrorType.AUTHENTICATION;
      }
      
      // Rate limit errors
      if (errorMessage.includes('quota') || 
          errorMessage.includes('rate limit') ||
          errorMessage.includes('too many requests')) {
        return GeminiErrorType.RATE_LIMIT;
      }
      
      // Invalid request
      if (errorMessage.includes('invalid') || 
          errorMessage.includes('bad request')) {
        return GeminiErrorType.INVALID_REQUEST;
      }
      
      // Safety filter
      if (errorMessage.includes('safety') || 
          errorMessage.includes('blocked') ||
          errorMessage.includes('filtered')) {
        return GeminiErrorType.SAFETY_FILTER;
      }
      
      // Service unavailable
      if (errorMessage.includes('unavailable') || 
          errorMessage.includes('503') ||
          errorMessage.includes('service error')) {
        return GeminiErrorType.SERVICE_UNAVAILABLE;
      }
      
      // Timeout
      if (errorMessage.includes('timeout') || 
          errorMessage.includes('timed out') ||
          errorMessage.includes('deadline exceeded')) {
        return GeminiErrorType.TIMEOUT;
      }
      
      // Network errors
      if (errorMessage.includes('network') ||
          errorMessage.includes('econnrefused') ||
          errorMessage.includes('enotfound')) {
        return GeminiErrorType.NETWORK;
      }
    }
    
    return GeminiErrorType.UNKNOWN;
  }

  /**
   * Generate response from Gemini with retry logic
   */
  async generateResponse(message: string, userId: string): Promise<ProviderResponse> {
    this.initializeClient();

    if (!this.model) {
      throw new InternalServerError(ERROR_MESSAGES[GeminiErrorType.AUTHENTICATION]);
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError: unknown;

    // Retry loop
    while (attempt <= this.maxRetries) {
      try {
        logger.debug(`Gemini request attempt ${attempt + 1}/${this.maxRetries + 1}`, {
          userId,
          model: this.modelName,
          messageLength: message.length,
        });

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timed out')), this.timeout);
        });

        // Generate content with timeout
        const resultPromise = this.model.generateContent(message);
        const result = await Promise.race([resultPromise, timeoutPromise]);

        const response = await result.response;
        const latency = Date.now() - startTime;
        
        // Normalize response format - extract text
        let responseText = '';
        try {
          responseText = response.text();
        } catch (error) {
          // Handle blocked/filtered responses
          const candidates = response.candidates;
          if (candidates && candidates.length > 0 && candidates[0]) {
            const finishReason = candidates[0].finishReason;
            if (finishReason === 'SAFETY') {
              throw new Error('Content blocked by safety filters');
            }
          }
          throw new Error('Failed to extract text from response');
        }

        // Estimate token usage (Gemini doesn't provide exact counts in basic API)
        const estimatedTokens = Math.ceil((message.length + responseText.length) / 4);

        // Log successful response
        logger.info('Gemini response generated successfully', {
          userId,
          model: this.modelName,
          latency: `${latency}ms`,
          tokensUsed: estimatedTokens,
          estimatedPromptTokens: Math.ceil(message.length / 4),
          estimatedCompletionTokens: Math.ceil(responseText.length / 4),
          attempt: attempt + 1,
        });

        // Return clean text (normalized format - same as OpenAI)
        return {
          text: responseText.trim(),
          provider: 'gemini',
          model: this.modelName,
          tokensUsed: estimatedTokens,
        };

      } catch (error) {
        lastError = error;
        attempt++;

        const errorType = this.mapError(error);
        const errorMessage = ERROR_MESSAGES[errorType];
        const latency = Date.now() - startTime;

        logger.error(`Gemini request failed (attempt ${attempt}/${this.maxRetries + 1})`, {
          userId,
          model: this.modelName,
          errorType,
          error: error instanceof Error ? error.message : 'Unknown error',
          latency: `${latency}ms`,
        });

        // Don't retry on authentication, invalid request, or safety filter errors
        if (errorType === GeminiErrorType.AUTHENTICATION || 
            errorType === GeminiErrorType.INVALID_REQUEST ||
            errorType === GeminiErrorType.SAFETY_FILTER) {
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
    return 'gemini';
  }
}
