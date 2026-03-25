import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from './errors';

/**
 * Validation helper functions
 */

export const validateChatRequest = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { message, userId, provider } = req.body;

  // Validate message
  if (!message) {
    throw new BadRequestError('Message is required');
  }

  if (typeof message !== 'string') {
    throw new BadRequestError('Message must be a string');
  }

  if (message.trim().length === 0) {
    throw new BadRequestError('Message cannot be empty');
  }

  if (message.length > 2000) {
    throw new BadRequestError('Message must not exceed 2000 characters');
  }

  // Validate userId
  if (!userId) {
    throw new BadRequestError('User ID is required');
  }

  if (typeof userId !== 'string') {
    throw new BadRequestError('User ID must be a string');
  }

  // Validate provider
  const validProviders = ['auto', 'openai', 'gemini'];
  if (provider && !validProviders.includes(provider)) {
    throw new BadRequestError(
      `Provider must be one of: ${validProviders.join(', ')}`
    );
  }

  next();
};
