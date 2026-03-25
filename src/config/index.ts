import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Validated configuration interface with strict types
 */
export interface Config {
  server: {
    env: 'development' | 'production' | 'test';
    port: number;
    host: string;
    maxRequestSize: string;
  };
  cors: {
    origin: string[];
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  api: {
    version: string;
    prefix: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
  rateLimit: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  security: {
    encryptionKey?: string;
  };
}

/**
 * Configuration validation error
 */
class ConfigValidationError extends Error {
  constructor(message: string) {
    super(`Configuration validation failed: ${message}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validate and get environment variable
 */
function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    throw new ConfigValidationError(`${name} is required but not set`);
  }
  return value || defaultValue || '';
}

/**
 * Validate and parse integer with bounds
 */
function getEnvInt(
  name: string,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  const value = process.env[name];
  const parsed = value ? parseInt(value, 10) : defaultValue;

  if (isNaN(parsed)) {
    throw new ConfigValidationError(`${name} must be a valid integer`);
  }
  if (min !== undefined && parsed < min) {
    throw new ConfigValidationError(`${name} must be at least ${min}`);
  }
  if (max !== undefined && parsed > max) {
    throw new ConfigValidationError(`${name} must be at most ${max}`);
  }
  return parsed;
}

/**
 * Validate and parse boolean
 */
function getEnvBool(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Validate CORS origins
 */
function validateCorsOrigins(origins: string): string[] {
  const originList = origins.split(',').map((origin) => origin.trim());
  for (const origin of originList) {
    if (origin !== '*' && !origin.match(/^https?:\/\/.+/)) {
      throw new ConfigValidationError(
        `Invalid CORS origin: ${origin}. Must be a valid URL or '*'`
      );
    }
  }
  return originList;
}

/**
 * Load and validate configuration
 */
function loadConfig(): Config {
  const nodeEnv = getEnvVar('NODE_ENV', 'development');
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new ConfigValidationError(
      'NODE_ENV must be development, production, or test'
    );
  }

  const logLevel = getEnvVar('LOG_LEVEL', 'info');
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    throw new ConfigValidationError(
      'LOG_LEVEL must be debug, info, warn, or error'
    );
  }

  const corsOrigin = getEnvVar(
    'CORS_ORIGIN',
    'http://localhost:3000,http://localhost:3001'
  );
  const origins = validateCorsOrigins(corsOrigin);

  const encryptionKey = process.env['ENCRYPTION_KEY'];
  if (nodeEnv === 'production' && !encryptionKey) {
    throw new ConfigValidationError(
      'ENCRYPTION_KEY is required in production'
    );
  }
  if (encryptionKey && encryptionKey.length < 32) {
    throw new ConfigValidationError(
      'ENCRYPTION_KEY must be at least 32 characters'
    );
  }

  return {
    server: {
      env: nodeEnv as 'development' | 'production' | 'test',
      port: getEnvInt('PORT', 3000, 1, 65535),
      host: getEnvVar('HOST', 'localhost'),
      maxRequestSize: getEnvVar('MAX_REQUEST_SIZE', '10mb'),
    },
    cors: {
      origin: origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    },
    api: {
      version: getEnvVar('API_VERSION', 'v1'),
      prefix: `/api/${getEnvVar('API_VERSION', 'v1')}`,
    },
    logging: {
      level: logLevel as 'debug' | 'info' | 'warn' | 'error',
    },
    rateLimit: {
      enabled: getEnvBool('ENABLE_RATE_LIMITING', true),
      windowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, 1000),
      maxRequests: getEnvInt('RATE_LIMIT_MAX_REQUESTS', 100, 1),
    },
    security: {
      encryptionKey,
    },
  };
}

// Load and freeze configuration
let config: Config;
try {
  config = loadConfig();
  // Freeze to prevent runtime modifications
  Object.freeze(config);
  Object.freeze(config.server);
  Object.freeze(config.cors);
  Object.freeze(config.api);
  Object.freeze(config.logging);
  Object.freeze(config.rateLimit);
  Object.freeze(config.security);
} catch (error) {
  console.error('❌ Configuration validation failed:', error);
  process.exit(1);
}

export default config;
