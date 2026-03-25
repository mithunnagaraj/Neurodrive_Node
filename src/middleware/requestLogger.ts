import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Request logging middleware
 * Logs incoming requests with method, URL, and response time
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    logger.info(`${method} ${originalUrl}`, {
      statusCode,
      duration: `${duration}ms`,
      ip,
      userAgent: req.get('user-agent') || 'unknown',
    });
  });

  next();
};
