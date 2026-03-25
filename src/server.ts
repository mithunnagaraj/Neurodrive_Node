import App from './app';
import config from './config';
import { logger } from './utils/logger';

/**
 * Start the Express server with graceful shutdown
 */
const startServer = async (): Promise<void> => {
  try {
    const { port, host, env } = config.server;
    
    // Initialize application
    const application = new App();
    const app = application.app;

    const server = app.listen(port, host, () => {
      logger.info(`🚀 Server started successfully`);
      logger.info(`📍 Environment: ${env}`);
      logger.info(`🌐 Server running on http://${host}:${port}`);
      logger.info(`🏥 Health check: http://${host}:${port}/health`);
      logger.info(`📝 API Version: ${config.api.version}`);
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (): Promise<void> => {
      logger.info('Received shutdown signal. Closing server gracefully...');
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        // Perform cleanup
        await application.shutdown();
        
        logger.info('Cleanup complete. Process terminating...');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    // Handle uncaught errors
    process.on('unhandledRejection', (reason: Error) => {
      logger.error('Unhandled Rejection:', reason);
      throw reason;
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
