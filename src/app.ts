import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import config from './config';
import routes from './routes';
import { 
  errorHandler, 
  requestLogger, 
  notFound 
} from './middleware';
import { requestId } from './middleware/requestId';
import { rateLimit } from './middleware/rateLimit';
import { sanitizeInput } from './middleware/sanitizeInput';
import { securityHeaders } from './middleware/securityHeaders';
import { requestTimeout } from './middleware/timeout';
import { cleanupContainer } from './container';

/**
 * Express Application Setup with Enhanced Security and Performance
 */
class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeSecurityMiddlewares();
    this.initializePerformanceMiddlewares();
    this.initializeParsingMiddlewares();
    this.initializeLoggingMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Security middlewares (applied first)
   */
  private initializeSecurityMiddlewares(): void {
    // Helmet - Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // Additional security headers
    this.app.use(securityHeaders);

    // Disable X-Powered-By header
    this.app.disable('x-powered-by');

    // Trust proxy if behind reverse proxy (for rate limiting)
    if (config.server.env === 'production') {
      this.app.set('trust proxy', 1);
    }
  }

  /**
   * Performance middlewares
   */
  private initializePerformanceMiddlewares(): void {
    // Response compression
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6, // Balance between speed and compression ratio
    }));
  }

  /**
   * Parsing and request processing middlewares
   */
  private initializeParsingMiddlewares(): void {
    // CORS configuration
    this.app.use(
      cors({
        origin: config.cors.origin,
        credentials: config.cors.credentials,
        methods: config.cors.methods,
        allowedHeaders: config.cors.allowedHeaders,
        maxAge: 86400, // 24 hours
      })
    );

    // Body parsing with size limits
    this.app.use(express.json({ 
      limit: config.server.maxRequestSize,
      strict: true,
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: config.server.maxRequestSize,
      parameterLimit: 1000,
    }));

    // Input sanitization (security)
    this.app.use(sanitizeInput);
  }

  /**
   * Logging and monitoring middlewares
   */
  private initializeLoggingMiddlewares(): void {
    // Request ID for tracing
    this.app.use(requestId);

    // Request timeout (prevent hung requests - 30s default)
    this.app.use(requestTimeout({ timeout: 30000 }));

    // Request logging
    this.app.use(requestLogger);

    // Rate limiting (if enabled)
    if (config.rateLimit.enabled) {
      this.app.use(rateLimit);
    }
  }

  /**
   * Initialize routes
   */
  private initializeRoutes(): void {
    this.app.use('/', routes);
  }

  /**
   * Initialize error handling (must be last)
   */
  private initializeErrorHandling(): void {
    // 404 handler (must be after all routes)
    this.app.use(notFound);

    // Global error handler (must be last)
    this.app.use(errorHandler);
  }

  /**
   * Graceful shutdown
   * Cleanup container resources
   */
  public async shutdown(): Promise<void> {
    cleanupContainer();
  }
}

export default App;
