// Middleware version for Express
import { Request, Response, NextFunction } from 'express';

export function validateChatRequest(req: Request, _res: Response, next: NextFunction): void {
  try {
    validateChatRequestFunctional(req.body);
    next();
  } catch (err) {
    next(err);
  }
}
import { BadRequestError } from './errors';

// For test compatibility
export class ValidationError extends BadRequestError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateProvider(provider: string): void {
  const validProviders = ['openai', 'anthropic', 'gemini', 'perplexity', 'groq'];
  if (!validProviders.includes(provider)) {
    throw new ValidationError(
      `Provider must be one of: ${validProviders.join(', ')}`
    );
  }
}

// Functional version for tests and internal use
export function validateChatRequestFunctional(
  req: { message?: any; provider?: any },
): void {
  const { message, provider } = req;

  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new ValidationError('Message must be a non-empty string');
  }
  if (message.length > 10000) {
    throw new ValidationError('Message must not exceed 10000 characters');
  }
  if (provider) {
    validateProvider(provider);
  }
}


