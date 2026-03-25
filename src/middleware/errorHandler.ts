import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/errors';
import { logger } from '../utils/logger';
import config from '../config';

/**
 * Global error handling middleware
 * Catches all errors and sends appropriate response
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  // Check if it's our custom ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Log error details
  logger.error(`${statusCode} - ${message}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    stack: err.stack,
  });

  // Send error response
  const errorResponse: {
    status: 'error';
    message: string;
    stack?: string;
  } = {
    status: 'error',
    message,
  };

  // Never expose stack traces to clients (security risk)
  // Stack traces are already logged above for debugging
  // if (config.server.env === 'development') {
  //   errorResponse.stack = err.stack;
  // }

  res.status(statusCode).json(errorResponse);

  // If error is not operational, we might want to exit the process
  // For production, consider using process managers like PM2
  if (!isOperational && config.server.env === 'production') {
    logger.error('Non-operational error detected. Server might be in unstable state.');
    // process.exit(1); // Uncomment for production with process manager
  }
};
