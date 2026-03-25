/**
 * Chat API Types and Interfaces
 */

export type AIProvider = 'auto' | 'openai' | 'gemini' | 'anthropic' | 'azure' | 'perplexity';

export interface ChatRequest {
  message: string;
  userId: string;
  provider: AIProvider;
}

export interface ChatResponse {
  reply: string;
  providerUsed: string;
}

export interface ProviderResponse {
  text: string;
  provider: string;
  tokensUsed?: number;
  model?: string;
}
