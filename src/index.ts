import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { apiRoutes } from './routes';
import { requestLogger, errorHandler, notFoundHandler } from './middleware';
import { databaseService } from './services/databaseService';

// Validate configuration on startup
try {
  validateConfig();
  logger.info('Configuration validated successfully');
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Configuration validation failed';
  logger.error('Configuration validation failed', { error: errorMessage });
  process.exit(1);
}

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLogger);

// Serve static frontend files
app.use(express.static('public'));

// API routes
app.use('/api', apiRoutes);

// Root endpoint - serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// API status endpoint
app.get('/status', (req, res) => {
  res.json({
    service: 'WxCC Overrides API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
  logger.info('Server started successfully', {
    port: config.port,
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connection
    try {
      databaseService.close();
    } catch (error) {
      logger.error('Error closing database during shutdown', { error });
    }
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forceful shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    type: 'unhandled_rejection',
    reason: reason,
    promise: promise
  });
  
  // In production, you might want to exit the process
  if (config.nodeEnv === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    type: 'uncaught_exception',
    error: error.message,
    stack: error.stack
  });
  
  // Exit the process - uncaught exceptions are serious
  process.exit(1);
});

export default app;