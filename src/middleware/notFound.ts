import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../utils/errors';

/**
 * 404 Not Found middleware
 * Catches all requests that don't match any routes
 */
export const notFound = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};
