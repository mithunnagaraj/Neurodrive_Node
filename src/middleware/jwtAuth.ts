import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * JWT Payload structure
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Authenticated request with user info
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * JWT Service for token generation and validation
 * 
 * Production considerations:
 * - Use environment variable for JWT_SECRET (must be strong)
 * - Consider using RS256 (asymmetric) for multi-service architecture
 * - Implement token refresh mechanism
 * - Store revoked tokens in Redis for logout
 */
export class JWTService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    this.secret = String(process.env['JWT_SECRET'] || 'default-secret-change-in-production');
    this.expiresIn = process.env['JWT_EXPIRES_IN'] || '24h';

    if (this.secret === 'default-secret-change-in-production') {
      logger.warn('⚠️  Using default JWT secret - CHANGE IN PRODUCTION!');
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.secret as string) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      } else {
        throw new UnauthorizedError('Token verification failed');
      }
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Decode token without verification (use with caution)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }
}

// Singleton instance
const jwtService = new JWTService();

/**
 * JWT Authentication Middleware
 * Validates JWT token and attaches user to request
 */
export const authenticateJWT = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    throw new UnauthorizedError('No authorization token provided');
  }

  // Extract token from "Bearer <token>"
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new UnauthorizedError('Invalid authorization format. Use: Bearer <token>');
  }

  const token = parts[1];

  try {
    if (!token) throw new UnauthorizedError('No token provided');
    const decoded = jwtService.verifyToken(token);
    (req as AuthenticatedRequest).user = decoded;
    
    logger.debug('JWT authentication successful', {
      userId: decoded.userId,
      role: decoded.role,
    });
    
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Authentication failed');
  }
};

/**
 * Optional JWT Authentication
 * Attaches user if token is valid, but doesn't reject if missing
 */
export const optionalJWT = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    next();
    return;
  }

  try {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      if (!token) throw new UnauthorizedError('No token provided');
      const decoded = jwtService.verifyToken(token);
      (req as AuthenticatedRequest).user = decoded;
    }
  } catch {
    // Silently fail for optional auth
  }

  next();
};

/**
 * Role-based authorization middleware
 * Use after authenticateJWT
 */
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!user.role || !allowedRoles.includes(user.role)) {
      throw new UnauthorizedError(
        `Access denied. Required roles: ${allowedRoles.join(', ')}`
      );
    }

    logger.debug('Role authorization successful', {
      userId: user.userId,
      role: user.role,
      required: allowedRoles,
    });

    next();
  };
};

/**
 * Example login/register endpoints (to be integrated with database)
 */
export const authController = {
  /**
   * Login endpoint - validates credentials and returns JWT
   * TODO: Integrate with database
   */
  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new UnauthorizedError('Email and password required');
    }

    // TODO: Fetch user from database
    // const user = await User.findOne({ email });
    // if (!user || !(await jwtService.comparePassword(password, user.passwordHash))) {
    //   throw new UnauthorizedError('Invalid credentials');
    // }

    // Mock user for testing
    const mockUser = {
      userId: 'user-123',
      email,
      role: 'user',
    };

    const token = jwtService.generateToken(mockUser);

    res.json({
      token,
      user: mockUser,
      expiresIn: jwtService['expiresIn'],
    });
  },

  /**
   * Register endpoint - creates user and returns JWT
   * TODO: Integrate with database
   */
  async register(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new UnauthorizedError('Email and password required');
    }

    // TODO: Check if user exists
    // const exists = await User.findOne({ email });
    // if (exists) {
    //   throw new BadRequestError('User already exists');
    // }

    // TODO: Create user in database
    // const passwordHash = await jwtService.hashPassword(password);
    // const user = await User.create({ email, passwordHash, name });

    // Mock user
    const mockUser = {
      userId: 'user-' + Date.now(),
      email,
      role: 'user',
    };

    const token = jwtService.generateToken(mockUser);

    res.status(201).json({
      token,
      user: mockUser,
      expiresIn: jwtService['expiresIn'],
    });
  },

  /**
   * Get current user endpoint
   */
  async me(req: Request, res: Response): Promise<void> {
    const user = (req as AuthenticatedRequest).user;
    res.json({ user });
  },
};

export { jwtService };
