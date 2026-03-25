import { validateProvider, validateChatRequestFunctional, ValidationError } from '../src/utils/validation';

describe('Validation', () => {
  describe('validateProvider', () => {
    it('should accept valid providers', () => {
      const validProviders = ['openai', 'anthropic', 'gemini', 'perplexity', 'groq'];

      validProviders.forEach((provider) => {
        expect(() => validateProvider(provider as any)).not.toThrow();
      });
    });

    it('should reject invalid providers', () => {
      const invalidProviders = ['invalid', 'gpt', 'chatgpt', '', null, undefined];

      invalidProviders.forEach((provider) => {
        expect(() => validateProvider(provider as any)).toThrow(ValidationError);
      });
    });

    it('should be case-sensitive', () => {
      expect(() => validateProvider('OpenAI' as any)).toThrow(ValidationError);
      expect(() => validateProvider('GEMINI' as any)).toThrow(ValidationError);
    });
  });

  describe('validateChatRequest', () => {
    it('should accept valid chat request', () => {
      const validRequest = {
        message: 'Hello, how are you?',
        provider: 'openai',
      };

      expect(() => validateChatRequestFunctional(validRequest as any)).not.toThrow();
    });

    it('should accept request without provider', () => {
      const requestWithoutProvider = {
        message: 'Hello',
      };

      expect(() => validateChatRequestFunctional(requestWithoutProvider as any)).not.toThrow();
    });

    it('should reject empty message', () => {
      const emptyMessage = {
        message: '',
        provider: 'openai',
      };

      expect(() => validateChatRequestFunctional(emptyMessage as any)).toThrow(ValidationError);
    });

    it('should reject whitespace-only message', () => {
      const whitespaceMessage = {
        message: '   ',
        provider: 'anthropic',
      };

      expect(() => validateChatRequestFunctional(whitespaceMessage as any)).toThrow(ValidationError);
    });

    it('should reject very long messages', () => {
      const longMessage = {
        message: 'a'.repeat(10001),
        provider: 'gemini',
      };

      expect(() => validateChatRequestFunctional(longMessage as any)).toThrow(ValidationError);
    });

    it('should reject invalid provider in request', () => {
      const invalidProvider = {
        message: 'Hello',
        provider: 'invalid-provider',
      };

      expect(() => validateChatRequestFunctional(invalidProvider as any)).toThrow(ValidationError);
    });

    it('should reject missing message field', () => {
      const missingMessage = {
        provider: 'openai',
      };

      expect(() => validateChatRequestFunctional(missingMessage as any)).toThrow(ValidationError);
    });

    it('should reject non-string message', () => {
      const nonStringMessage = {
        message: 12345,
        provider: 'anthropic',
      };

      expect(() => validateChatRequestFunctional(nonStringMessage as any)).toThrow(ValidationError);
    });

    it('should accept message at max length', () => {
      const maxLengthMessage = {
        message: 'a'.repeat(10000),
        provider: 'openai',
      };

      expect(() => validateChatRequestFunctional(maxLengthMessage as any)).not.toThrow();
    });
  });
});
