import { ChatRequest, ChatResponse } from '../types/chat.types';
import { ProviderFactory } from '../providers/ProviderFactory';
import { IAIProvider } from '../providers/interfaces/IAIProvider';
import { logger } from '../utils/logger';
import { InternalServerError } from '../utils/errors';
import { Cache } from '../utils/cache';

/**
 * Chat Service with Dependency Injection and Caching
 * Handles business logic for chat functionality
 */
export class ChatService {
  private readonly RESPONSE_CACHE_TTL = 300; // 5 minutes cache for identical messages

  constructor(
    private readonly providerFactory: ProviderFactory,
    private readonly cache: Cache
  ) {}

  /**
   * Process chat message and generate response with caching
   */
  async processMessage(chatRequest: ChatRequest): Promise<ChatResponse> {
    const { message, userId, provider } = chatRequest;

    try {
      logger.info(`Processing chat message for user: ${userId}, provider: ${provider}`);

      // Check cache for identical recent message (optional optimization)
      const cacheKey = this.getCacheKey(userId, message, provider);
      const cachedResponse = this.cache.get<ChatResponse>(cacheKey);
      
      if (cachedResponse) {
        logger.debug(`Returning cached response for user: ${userId}`);
        return cachedResponse;
      }

      // Select provider
      let selectedProvider: IAIProvider;
      if (provider === 'auto') {
        selectedProvider = await this.providerFactory.getAutoProvider(userId);
      } else {
        selectedProvider = this.providerFactory.getProvider(provider);
      }

      // Check provider availability
      const isAvailable = await selectedProvider.isAvailable(userId);
      if (!isAvailable) {
        throw new InternalServerError(
          `Provider ${selectedProvider.getProviderName()} is not available. Please configure your API key.`
        );
      }

      // Generate response from provider
      const providerResponse = await selectedProvider.generateResponse(
        message,
        userId
      );

      logger.info(`Chat response generated using ${providerResponse.provider}`, {
        userId,
        tokensUsed: providerResponse.tokensUsed,
        model: providerResponse.model,
      });

      // Return formatted response
      const response: ChatResponse = {
        reply: providerResponse.text,
        providerUsed: providerResponse.provider,
      };

      // Cache the response
      this.cache.set(cacheKey, response, this.RESPONSE_CACHE_TTL);

      return response;
    } catch (error) {
      logger.error('Error processing chat message:', {
        userId,
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get available providers for a user
   */
  async getAvailableProviders(userId: string): Promise<string[]> {
    logger.debug(`Getting available providers for user: ${userId}`);
    
    const allProviders = this.providerFactory.getAvailableProviders();
    const availableProviders: string[] = [];

    for (const providerName of allProviders) {
      const provider = this.providerFactory.getProvider(providerName as 'openai' | 'gemini');
      if (await provider.isAvailable(userId)) {
        availableProviders.push(providerName);
      }
    }

    return availableProviders;
  }

  /**
   * Clear cache for a specific user
   */
  clearUserCache(userId: string): void {
    this.providerFactory.clearCache(userId);
    // Clear chat response cache for this user
    const stats = this.cache.getStats();
    for (const key of stats.keys) {
      if (key.startsWith(`chat:${userId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Generate cache key for chat responses
   */
  private getCacheKey(userId: string, message: string, provider: string): string {
    // Simple hash of message for cache key
    const messageHash = Buffer.from(message).toString('base64').slice(0, 32);
    return `chat:${userId}:${provider}:${messageHash}`;
  }
}
