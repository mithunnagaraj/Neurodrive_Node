import { Request, Response, NextFunction } from 'express';

/**
 * Async handler wrapper to eliminate try-catch blocks in controllers
 * Automatically catches errors and passes them to error handling middleware
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
