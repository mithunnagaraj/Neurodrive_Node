import { ProviderResponse } from '../../types/chat.types';

/**
 * Base AI Provider Interface
 * All AI providers must implement this interface
 */
export interface IAIProvider {
  /**
   * Generate a chat completion
   * @param message - User message
   * @param userId - User identifier (for BYOK mapping)
   * @returns Provider response with generated text
   */
  generateResponse(message: string, userId: string): Promise<ProviderResponse>;

  /**
   * Check if provider is available and configured
   * @param userId - User identifier
   * @returns Whether the provider is available
   */
  isAvailable(userId: string): Promise<boolean>;

  /**
   * Get provider name
   */
  getProviderName(): string;
}
