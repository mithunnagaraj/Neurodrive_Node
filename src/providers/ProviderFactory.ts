import { IAIProvider } from './interfaces/IAIProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { GeminiProvider } from './GeminiProvider';
import { AIProvider } from '../types/chat.types';
import { BadRequestError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Cache } from '../utils/cache';

/**
 * Provider Factory with Dependency Injection
 * Creates and manages AI provider instances with caching
 */
export class ProviderFactory {
  private providers: Map<string, IAIProvider>;
  private cache: Cache;
  private readonly PROVIDER_AVAILABILITY_TTL = 60; // Cache availability for 60 seconds

  constructor(cache: Cache) {
    this.providers = new Map();
    this.cache = cache;
    this.initializeProviders();
  }

  /**
   * Initialize all available providers
   * Providers are lazy-loaded and cached
   */
  private initializeProviders(): void {
    // Register providers without instantiating them immediately
    this.providers.set('openai', new OpenAIProvider());
    this.providers.set('gemini', new GeminiProvider());
  }

  /**
   * Get provider by name with validation
   */
  getProvider(providerName: AIProvider): IAIProvider {
    if (providerName === 'auto') {
      throw new BadRequestError(
        'Auto provider resolution should be handled by service layer'
      );
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new BadRequestError(`Provider "${providerName}" not found`);
    }

    return provider;
  }

  /**
   * Auto-select best available provider for user
   * Uses caching to improve performance
   */
  async getAutoProvider(userId: string): Promise<IAIProvider> {
    // Check cache for previously selected provider
    const cacheKey = `auto-provider:${userId}`;
    const cachedProvider = this.cache.get<string>(cacheKey);

    if (cachedProvider) {
      logger.debug(`Using cached provider selection: ${cachedProvider}`);
      const provider = this.providers.get(cachedProvider);
      if (provider) {
        return provider;
      }
    }

    logger.debug(`Auto-selecting provider for user: ${userId}`);

    // Check providers in order of preference
    const preferenceOrder = ['openai', 'gemini'];

    for (const providerName of preferenceOrder) {
      const provider = this.providers.get(providerName);
      if (provider && (await this.checkAvailability(provider, userId))) {
        logger.info(`Auto-selected provider: ${providerName} for user: ${userId}`);
        
        // Cache the selection
        this.cache.set(cacheKey, providerName, this.PROVIDER_AVAILABILITY_TTL);
        return provider;
      }
    }

    throw new BadRequestError(
      'No AI provider available. Please configure your API keys.'
    );
  }

  /**
   * Check provider availability with caching
   */
  private async checkAvailability(
    provider: IAIProvider,
    userId: string
  ): Promise<boolean> {
    const cacheKey = `provider-available:${provider.getProviderName()}:${userId}`;
    const cached = this.cache.get<boolean>(cacheKey);

    if (cached !== null) {
      return cached;
    }

    const available = await provider.isAvailable(userId);
    this.cache.set(cacheKey, available, this.PROVIDER_AVAILABILITY_TTL);
    return available;
  }

  /**
   * Get all available provider names
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Register a new provider dynamically
   * Supports runtime provider registration for extensibility
   */
  registerProvider(name: string, provider: IAIProvider): void {
    if (this.providers.has(name)) {
      logger.warn(`Provider "${name}" already exists, overwriting`);
    }
    this.providers.set(name, provider);
    logger.info(`Registered new provider: ${name}`);
  }

  /**
   * Clear provider cache for a user
   */
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(`auto-provider:${userId}`);
      for (const providerName of this.providers.keys()) {
        this.cache.delete(`provider-available:${providerName}:${userId}`);
      }
    } else {
      // Clear all provider-related cache
      const stats = this.cache.getStats();
      for (const key of stats.keys) {
        if (key.startsWith('auto-provider:') || key.startsWith('provider-available:')) {
          this.cache.delete(key);
        }
      }
    }
  }
}
