import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Authentication Middleware Skeleton
 * 
 * TODO: Implement full authentication logic:
 * 1. JWT token validation
 * 2. API key validation
 * 3. User session management
 * 4. BYOK (Bring Your Own Key) support
 * 
 * Current: Placeholder that logs warnings
 * Production: Reject unauthenticated requests
 */

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
    apiKeys?: Record<string, string>; // For BYOK
  };
}

/**
 * JWT Authentication Middleware (Skeleton)
 * 
 * In production, this should:
 * 1. Extract JWT from Authorization header
 * 2. Verify JWT signature with secret key
 * 3. Check token expiration
 * 4. Attach user info to request
 * 5. Reject invalid tokens
 */
export const authenticateJWT = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    logger.warn('⚠️  AUTH DISABLED: No authorization header provided', {
      path: req.path,
      ip: req.ip,
    });
    
    // TEMPORARY: Allow unauthenticated requests
    // TODO: Uncomment for production
    // throw new UnauthorizedError('No authorization token provided');
    
    next();
    return;
  }

  // TEMPORARY: Log but don't validate
  logger.warn('⚠️  AUTH DISABLED: Token not validated', {
    path: req.path,
    hasToken: !!authHeader,
  });

  // TODO: Implement JWT validation
  // const token = authHeader.split(' ')[1]; // Bearer <token>
  // try {
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET!);
  //   (req as AuthenticatedRequest).user = decoded as any;
  //   next();
  // } catch (error) {
  //   throw new UnauthorizedError('Invalid or expired token');
  // }

  next();
};

/**
 * API Key Authentication Middleware (Skeleton)
 * 
 * For service-to-service authentication
 */
export const authenticateAPIKey = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    logger.warn('⚠️  API KEY AUTH DISABLED: No API key provided', {
      path: req.path,
    });
    
    // TEMPORARY: Allow requests without API key
    // TODO: Uncomment for production
    // throw new UnauthorizedError('API key required');
    
    next();
    return;
  }

  // TODO: Validate API key against database
  // const isValid = await validateAPIKey(apiKey);
  // if (!isValid) {
  //   throw new UnauthorizedError('Invalid API key');
  // }

  logger.warn('⚠️  API KEY AUTH DISABLED: Key not validated');

  next();
};

/**
 * Optional Authentication
 * Extracts user info if provided, but doesn't reject if missing
 */
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  
  if (authHeader) {
    // TODO: Try to extract user info but don't fail if invalid
    logger.debug('Optional auth header present', { hasToken: !!authHeader });
  }

  next();
};

/**
 * Role-based authorization middleware (Skeleton)
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(user.role || '')) {
      throw new UnauthorizedError(
        `Requires one of: ${roles.join(', ')}`
      );
    }

    next();
  };
};

/**
 * BYOK (Bring Your Own Key) Middleware
 * Allows users to provide their own AI provider API keys
 */
export const extractUserAPIKeys = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  // TODO: Fetch user's API keys from database
  // const user = (req as AuthenticatedRequest).user;
  // if (user) {
  //   user.apiKeys = await getUserAPIKeys(user.id);
  // }

  logger.debug('⚠️  BYOK NOT IMPLEMENTED: Using system API keys');

  next();
};
