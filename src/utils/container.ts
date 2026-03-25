/**
 * Dependency Injection Container
 * Manages service instances and dependencies for better testability and scalability
 */

type Constructor<T> = new (...args: unknown[]) => T;
type Factory<T> = () => T;

interface ServiceDefinition<T> {
  singleton: boolean;
  factory: Factory<T>;
  instance?: T;
}

export class Container {
  private services: Map<string, ServiceDefinition<unknown>>;

  constructor() {
    this.services = new Map();
  }

  /**
   * Register a singleton service
   * Instance is created once and reused
   */
  registerSingleton<T>(name: string, factory: Factory<T>): void {
    this.services.set(name, {
      singleton: true,
      factory,
    });
  }

  /**
   * Register a transient service
   * New instance is created on each resolve
   */
  registerTransient<T>(name: string, factory: Factory<T>): void {
    this.services.set(name, {
      singleton: false,
      factory,
    });
  }

  /**
   * Register a class as singleton
   */
  registerClass<T>(name: string, ctor: Constructor<T>): void {
    this.registerSingleton(name, () => new ctor());
  }

  /**
   * Register an existing instance
   */
  registerInstance<T>(name: string, instance: T): void {
    this.services.set(name, {
      singleton: true,
      factory: () => instance,
      instance,
    });
  }

  /**
   * Resolve a service by name
   */
  resolve<T>(name: string): T {
    const definition = this.services.get(name);

    if (!definition) {
      throw new Error(`Service "${name}" not registered in container`);
    }

    if (definition.singleton) {
      if (!definition.instance) {
        definition.instance = definition.factory();
      }
      return definition.instance as T;
    }

    return definition.factory() as T;
  }

  /**
   * Check if service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }
}

// Global container instance
export const container = new Container();

// Service names constants for type safety
export const SERVICE_NAMES = {
  CACHE: 'cache',
  LOGGER: 'logger',
  PROVIDER_FACTORY: 'providerFactory',
  CHAT_SERVICE: 'chatService',
  HEALTH_SERVICE: 'healthService',
  LLM_ROUTER: 'llmRouter',
  JWT_SERVICE: 'jwtService',
  CIRCUIT_BREAKER_MANAGER: 'circuitBreakerManager',
  SECRETS_MANAGER: 'secretsManager',
} as const;
