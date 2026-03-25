import { AIProvider } from '../types/chat.types';
import { logger } from '../utils/logger';
import config from '../config';

/**
 * Routing decision metadata
 */
export interface RoutingDecision {
  provider: AIProvider;
  reason: string;
  metadata: {
    messageLength: number;
    threshold: number;
    wasOverridden: boolean;
  };
}

/**
 * LLM Router Service
 * Intelligently routes requests to appropriate AI providers based on message characteristics
 */
export class LLMRouter {
  /**
   * Route based on message characteristics
   * 
   * Rules:
   * - If provider is explicitly specified (not 'auto'), use that provider
   * - If provider = 'auto':
   *   - message < threshold → Gemini (fast, cost-effective for short queries)
   *   - message ≥ threshold → OpenAI (better for complex, longer queries)
   */
  public route(message: string, requestedProvider: AIProvider): RoutingDecision {
    const messageLength = message.length;
    const threshold = config.router.lengthThreshold;

    // If provider is explicitly specified, honor the override
    if (requestedProvider !== 'auto') {
      logger.info(`Provider override: using ${requestedProvider}`, {
        messageLength,
        requestedProvider,
      });

      return {
        provider: requestedProvider,
        reason: 'Explicit provider override in request',
        metadata: {
          messageLength,
          threshold,
          wasOverridden: true,
        },
      };
    }

    // Auto-routing logic based on message length
    let selectedProvider: AIProvider;
    let reason: string;

    if (messageLength < threshold) {
      selectedProvider = config.router.shortMessageProvider as AIProvider;
      reason = `Short message (${messageLength} < ${threshold} chars) → ${selectedProvider}`;
    } else {
      selectedProvider = config.router.longMessageProvider as AIProvider;
      reason = `Long message (${messageLength} ≥ ${threshold} chars) → ${selectedProvider}`;
    }

    logger.info(`LLM Router decision: ${selectedProvider}`, {
      messageLength,
      threshold,
      selectedProvider,
      reason,
    });

    return {
      provider: selectedProvider,
      reason,
      metadata: {
        messageLength,
        threshold,
        wasOverridden: false,
      },
    };
  }

  /**
   * Get routing statistics for monitoring
   */
  public getRoutingInfo(message: string): {
    length: number;
    threshold: number;
    wouldRouteToShort: boolean;
    wouldRouteToLong: boolean;
    shortProvider: string;
    longProvider: string;
  } {
    return {
      length: message.length,
      threshold: config.router.lengthThreshold,
      wouldRouteToShort: message.length < config.router.lengthThreshold,
      wouldRouteToLong: message.length >= config.router.lengthThreshold,
      shortProvider: config.router.shortMessageProvider,
      longProvider: config.router.longMessageProvider,
    };
  }
}
