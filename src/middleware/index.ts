import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    type: 'http_request',
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      type: 'http_response',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      success: res.statusCode < 400
    });

    return originalJson(body);
  };

  next();
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    type: 'unhandled_error',
    method: req.method,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  logger.warn('Route not found', {
    type: 'route_not_found',
    method: req.method,
    url: req.originalUrl
  });

  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `${req.method} ${req.originalUrl} not found`
  });
};