import { Container, SERVICE_NAMES } from './utils/container';
import { Cache } from './utils/cache';
import { ProviderFactory } from './providers/ProviderFactory';
import { ChatService } from './services/chatService';
import { HealthService } from './services/healthService';

/**
 * Application Dependency Injection Container
 * Centralizes service creation and lifecycle management
 * 
 * This container follows the "Hollywood Principle" - Don't call us, we'll call you
 * Services don't create their dependencies; they receive them via constructor injection
 */

// Create and configure the application container
export const container = new Container();

/**
 * Register core utilities as singletons
 * These are shared across the entire application
 */

// Cache instance (singleton - shared state for caching)
container.registerSingleton(SERVICE_NAMES.CACHE, () => {
  const cache = new Cache();
  return cache;
});

/**
 * Register providers and factories
 */

// Provider Factory (singleton - manages provider instances)
container.registerSingleton(SERVICE_NAMES.PROVIDER_FACTORY, () => {
  const cache = container.resolve<Cache>(SERVICE_NAMES.CACHE);
  return new ProviderFactory(cache);
});

/**
 * Register business services
 * Services are singletons by default for efficiency
 */

// Health Service (singleton - lightweight, no state)
container.registerSingleton(SERVICE_NAMES.HEALTH_SERVICE, () => {
  return new HealthService();
});

// Chat Service (singleton - uses injected dependencies)
container.registerSingleton(SERVICE_NAMES.CHAT_SERVICE, () => {
  const providerFactory = container.resolve<ProviderFactory>(SERVICE_NAMES.PROVIDER_FACTORY);
  const cache = container.resolve<Cache>(SERVICE_NAMES.CACHE);
  return new ChatService(providerFactory, cache);
});

/**
 * Cleanup function for graceful shutdown
 * Destroys cache and cleans up resources
 */
export const cleanupContainer = (): void => {
  const cache = container.resolve<Cache>(SERVICE_NAMES.CACHE);
  cache.destroy();
};

/**
 * Helper functions for resolving common services
 * Provides type-safe access to services
 */
export const getChatService = (): ChatService => {
  return container.resolve<ChatService>(SERVICE_NAMES.CHAT_SERVICE);
};

export const getHealthService = (): HealthService => {
  return container.resolve<HealthService>(SERVICE_NAMES.HEALTH_SERVICE);
};

export const getCache = (): Cache => {
  return container.resolve<Cache>(SERVICE_NAMES.CACHE);
};
