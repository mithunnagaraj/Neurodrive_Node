import winston from 'winston';
import config from '../config';

/**
 * Winston-based structured logging for production
 * 
 * Benefits over basic console logging:
 * ✅ Structured JSON output (easy to parse/aggregate)
 * ✅ Multiple transports (file, console, external services)
 * ✅ Log levels with filtering
 * ✅ Async logging (non-blocking)
 * ✅ Error stack traces
 * ✅ Performance optimized
 */

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development (human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      // Filter out empty objects and timestamps
      const cleanMeta = Object.entries(meta)
        .filter(([key, val]) => key !== 'timestamp' && val !== undefined && val !== null)
        .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});
      
      if (Object.keys(cleanMeta).length > 0) {
        msg += ` ${JSON.stringify(cleanMeta)}`;
      }
    }
    
    return msg;
  })
);

// Create logger instance
const winstonLogger = winston.createLogger({
  level: config.logging.level || 'info',
  format: logFormat,
  defaultMeta: { service: 'neurodrive-api' },
  transports: [
    // Console output (always enabled)
    new winston.transports.Console({
      format: config.server.env === 'production' ? logFormat : consoleFormat,
    }),
  ],
});

// Add file transports in production
if (config.server.env === 'production') {
  // Error log file
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined log file
  winstonLogger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

/**
 * Structured logger interface compatible with existing logger
 */
export class WinstonLogger {
  /**
   * Debug level - detailed information for debugging
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.debug(message, meta);
  }

  /**
   * Info level - general informational messages
   */
  info(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.info(message, meta);
  }

  /**
   * Warn level - warning messages for potentially harmful situations
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.warn(message, meta);
  }

  /**
   * Error level - error messages for serious problems
   */
  error(message: string, meta?: Record<string, unknown> | Error): void {
    if (meta instanceof Error) {
      winstonLogger.error(message, {
        error: meta.message,
        stack: meta.stack,
        name: meta.name,
      });
    } else {
      winstonLogger.error(message, meta);
    }
  }

  /**
   * HTTP request logging helper
   */
  http(message: string, meta?: Record<string, unknown>): void {
    winstonLogger.http(message, meta);
  }

  /**
   * Get the underlying Winston logger instance
   */
  getWinstonInstance(): winston.Logger {
    return winstonLogger;
  }
}

// Export singleton instance
export const winstonLogger_ = new WinstonLogger();
