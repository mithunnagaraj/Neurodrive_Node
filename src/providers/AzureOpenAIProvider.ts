import { AzureOpenAI } from 'openai';
import { IAIProvider } from './interfaces/IAIProvider';
import { ProviderResponse } from '../types/chat.types';
import { logger } from '../utils/logger';
import config from '../config';
import { InternalServerError, BadRequestError } from '../utils/errors';

/**
 * Error types for user-friendly messaging
 */
enum AzureOpenAIErrorType {
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  INVALID_REQUEST = 'invalid_request',
  MODEL_OVERLOADED = 'model_overloaded',
  NETWORK = 'network',
  CONFIGURATION = 'configuration',
  UNKNOWN = 'unknown',
}

/**
 * User-friendly error messages
 */
const ERROR_MESSAGES: Record<AzureOpenAIErrorType, string> = {
  [AzureOpenAIErrorType.AUTHENTICATION]: 'Azure OpenAI API key is invalid or missing. Please check your configuration.',
  [AzureOpenAIErrorType.RATE_LIMIT]: 'Azure OpenAI rate limit exceeded. Please try again in a moment.',
  [AzureOpenAIErrorType.TIMEOUT]: 'Azure OpenAI request timed out. Please try again.',
  [AzureOpenAIErrorType.INVALID_REQUEST]: 'Invalid request to Azure OpenAI. Please check your message.',
  [AzureOpenAIErrorType.MODEL_OVERLOADED]: 'Azure OpenAI is currently overloaded. Please try again shortly.',
  [AzureOpenAIErrorType.NETWORK]: 'Network error connecting to Azure OpenAI. Please check your connection.',
  [AzureOpenAIErrorType.CONFIGURATION]: 'Azure OpenAI is not properly configured. Please check endpoint and deployment name.',
  [AzureOpenAIErrorType.UNKNOWN]: 'An unexpected error occurred with Azure OpenAI. Please try again.',
};

/**
 * Azure OpenAI Provider Implementation
 * Uses official Azure OpenAI SDK with retry logic, timeout, and error mapping
 */
export class AzureOpenAIProvider implements IAIProvider {
  private client: AzureOpenAI | null = null;
  private readonly deploymentName: string | undefined;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor() {
    this.deploymentName = config.azure.deploymentName;
    this.timeout = config.azure.timeout;
    this.maxRetries = config.azure.maxRetries;
  }

  /**
   * Initialize Azure OpenAI client if configuration is available
   */
  private initializeClient(): void {
    if (!config.azure.apiKey || !config.azure.endpoint || !config.azure.deploymentName) {
      return;
    }

    if (!this.client) {
      this.client = new AzureOpenAI({
        apiKey: config.azure.apiKey,
        endpoint: config.azure.endpoint,
        deployment: config.azure.deploymentName,
        apiVersion: '2024-10-21',
      });
      logger.debug('Azure OpenAI client initialized', {
        endpoint: config.azure.endpoint,
        deploymentName: this.deploymentName,
        timeout: this.timeout,
        maxRetries: this.maxRetries,
      });
    }
  }

  /**
   * Check if Azure OpenAI is available for the user
   */
  async isAvailable(userId: string): Promise<boolean> {
    const available = !!(
      config.azure.apiKey &&
      config.azure.endpoint &&
      config.azure.deploymentName
    );
    
    logger.debug(`Azure OpenAI availability check for user ${userId}: ${available}`);
    return available;
  }

  /**
   * Map Azure OpenAI errors to user-friendly error types
   */
  private mapError(error: unknown): AzureOpenAIErrorType {
    // Azure uses the same error types as OpenAI
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      
      // Authentication errors
      if (status === 401 || status === 403) {
        return AzureOpenAIErrorType.AUTHENTICATION;
      }
      
      // Rate limit errors
      if (status === 429) {
        return AzureOpenAIErrorType.RATE_LIMIT;
      }
      
      // Invalid request
      if (status === 400) {
        return AzureOpenAIErrorType.INVALID_REQUEST;
      }
      
      // Model overloaded
      if (status === 503) {
        return AzureOpenAIErrorType.MODEL_OVERLOADED;
      }
    }
    
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      // Configuration errors
      if (errorMessage.includes('endpoint') || errorMessage.includes('deployment')) {
        return AzureOpenAIErrorType.CONFIGURATION;
      }
      
      // Timeout
      if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
        return AzureOpenAIErrorType.TIMEOUT;
      }
      
      // Network errors
      if (errorMessage.includes('econnrefused') || 
          errorMessage.includes('enotfound') || 
          errorMessage.includes('network')) {
        return AzureOpenAIErrorType.NETWORK;
      }
    }
    
    return AzureOpenAIErrorType.UNKNOWN;
  }

  /**
   * Generate response from Azure OpenAI with retry logic
   */
  async generateResponse(message: string, userId: string): Promise<ProviderResponse> {
    this.initializeClient();

    if (!this.client || !this.deploymentName) {
      throw new InternalServerError(ERROR_MESSAGES[AzureOpenAIErrorType.CONFIGURATION]);
    }

    const startTime = Date.now();
    let attempt = 0;
    let lastError: unknown;

    // Retry loop
    while (attempt <= this.maxRetries) {
      try {
        logger.debug(`Azure OpenAI request attempt ${attempt + 1}/${this.maxRetries + 1}`, {
          userId,
          deploymentName: this.deploymentName,
          messageLength: message.length,
        });

        const completion = await this.client.chat.completions.create({
          model: this.deploymentName!, // For Azure, model is the deployment name
          messages: [
            {
              role: 'system',
              content: 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.',
            },
            {
              role: 'user',
              content: message,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        });

        const latency = Date.now() - startTime;
        const responseText = completion.choices[0]?.message?.content || '';
        const tokensUsed = completion.usage?.total_tokens || 0;
        const promptTokens = completion.usage?.prompt_tokens || 0;
        const completionTokens = completion.usage?.completion_tokens || 0;

        // Log successful response
        logger.info('Azure OpenAI response generated successfully', {
          userId,
          deploymentName: this.deploymentName,
          latency: `${latency}ms`,
          tokensUsed,
          promptTokens,
          completionTokens,
          attempt: attempt + 1,
        });

        // Return clean text (no metadata)
        return {
          text: responseText.trim(),
          provider: 'azure',
          model: this.deploymentName,
          tokensUsed,
        };

      } catch (error) {
        lastError = error;
        attempt++;

        const errorType = this.mapError(error);
        const errorMessage = ERROR_MESSAGES[errorType];
        const latency = Date.now() - startTime;

        logger.error(`Azure OpenAI request failed (attempt ${attempt}/${this.maxRetries + 1})`, {
          userId,
          deploymentName: this.deploymentName,
          errorType,
          error: error instanceof Error ? error.message : 'Unknown error',
          latency: `${latency}ms`,
        });

        // Don't retry on authentication, configuration, or invalid request errors
        if (errorType === AzureOpenAIErrorType.AUTHENTICATION || 
            errorType === AzureOpenAIErrorType.INVALID_REQUEST ||
            errorType === AzureOpenAIErrorType.CONFIGURATION) {
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
    return 'azure';
  }
}
