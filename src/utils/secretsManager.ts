import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { logger } from '../utils/logger';

/**
 * Secrets Manager Integration
 * 
 * Supports:
 * - AWS Secrets Manager
 * - Azure Key Vault
 * - Environment variables (fallback)
 * 
 * Environment Variables:
 * - SECRETS_PROVIDER: 'aws' | 'azure' | 'env' (default: 'env')
 * - AWS_REGION: AWS region for Secrets Manager
 * - AZURE_KEYVAULT_URL: Azure Key Vault URL
 */

type SecretsProvider = 'aws' | 'azure' | 'env';

export class SecretsManager {
  private provider: SecretsProvider;
  private awsClient?: SecretsManagerClient;
  private azureClient?: SecretClient;
  private cache: Map<string, { value: string; timestamp: number }> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.provider = (process.env['SECRETS_PROVIDER'] as SecretsProvider) || 'env';
    this.initializeProvider();
  }

  /**
   * Initialize secrets provider based on configuration
   */
  private initializeProvider(): void {
    switch (this.provider) {
      case 'aws':
        this.initializeAWS();
        break;
      case 'azure':
        this.initializeAzure();
        break;
      case 'env':
      default:
        logger.info('Using environment variables for secrets');
        break;
    }
  }

  /**
   * Initialize AWS Secrets Manager client
   */
  private initializeAWS(): void {
    try {
      this.awsClient = new SecretsManagerClient({
        region: process.env['AWS_REGION'] || 'us-east-1',
      });
      logger.info('AWS Secrets Manager initialized', {
        region: process.env['AWS_REGION'] || 'us-east-1',
      });
    } catch (error) {
      logger.error('Failed to initialize AWS Secrets Manager', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Initialize Azure Key Vault client
   */
  private initializeAzure(): void {
    try {
      const vaultUrl = process.env['AZURE_KEYVAULT_URL'];
      if (!vaultUrl) {
        throw new Error('AZURE_KEYVAULT_URL not configured');
      }

      const credential = new DefaultAzureCredential();
      this.azureClient = new SecretClient(vaultUrl, credential);
      logger.info('Azure Key Vault initialized', { vaultUrl });
    } catch (error) {
      logger.error('Failed to initialize Azure Key Vault', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get secret value
   * Tries cache first, then provider
   */
  async getSecret(secretName: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.debug('Secret retrieved from cache', { secretName });
      return cached.value;
    }

    // Fetch from provider
    let value: string | null = null;

    try {
      switch (this.provider) {
        case 'aws':
          value = await this.getSecretFromAWS(secretName);
          break;
        case 'azure':
          value = await this.getSecretFromAzure(secretName);
          break;
        case 'env':
        default:
          value = this.getSecretFromEnv(secretName);
          break;
      }

      // Cache the value
      if (value) {
        this.cache.set(secretName, { value, timestamp: Date.now() });
      }

      return value;
    } catch (error) {
      logger.error('Failed to retrieve secret', {
        secretName,
        provider: this.provider,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get secret from AWS Secrets Manager
   */
  private async getSecretFromAWS(secretName: string): Promise<string | null> {
    if (!this.awsClient) {
      throw new Error('AWS Secrets Manager not initialized');
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.awsClient.send(command);

      if (response.SecretString) {
        logger.debug('Secret retrieved from AWS', { secretName });
        return response.SecretString;
      }

      return null;
    } catch (error) {
      logger.error('AWS Secrets Manager error', {
        secretName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get secret from Azure Key Vault
   */
  private async getSecretFromAzure(secretName: string): Promise<string | null> {
    if (!this.azureClient) {
      throw new Error('Azure Key Vault not initialized');
    }

    try {
      const secret = await this.azureClient.getSecret(secretName);
      if (secret.value) {
        logger.debug('Secret retrieved from Azure', { secretName });
        return secret.value;
      }

      return null;
    } catch (error) {
      logger.error('Azure Key Vault error', {
        secretName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get secret from environment variables
   */
  private getSecretFromEnv(secretName: string): string | null {
    const value = process.env[secretName];
    if (value) {
      logger.debug('Secret retrieved from environment', { secretName });
      return value;
    }

    logger.warn('Secret not found in environment', { secretName });
    return null;
  }

  /**
   * Get API key for a specific provider
   * Convention: PROVIDER_API_KEY (e.g., OPENAI_API_KEY)
   */
  async getProviderApiKey(provider: string): Promise<string | null> {
    const secretName = `${provider.toUpperCase()}_API_KEY`;
    return this.getSecret(secretName);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Secrets cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const secretsManager = new SecretsManager();

/**
 * Helper function to get provider API keys
 * Falls back to environment variables if secrets manager fails
 */
export async function getProviderApiKey(provider: string): Promise<string | null> {
  try {
    return await secretsManager.getProviderApiKey(provider);
  } catch (error) {
    logger.warn('Falling back to environment variable', {
      provider,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return process.env[`${provider.toUpperCase()}_API_KEY`] || null;
  }
}
