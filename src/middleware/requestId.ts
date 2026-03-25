import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Add unique request ID to each request for tracing
 * This improves debugging and log correlation
 */
export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  // Attach to request for use in handlers
  (req as Request & { id: string }).id = requestId;
  
  // Return in response headers
  res.setHeader('X-Request-ID', requestId);
  
  next();
};
