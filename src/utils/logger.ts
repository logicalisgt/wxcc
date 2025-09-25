import winston from 'winston';
import { config } from '../config';

// Create winston logger with structured JSON format
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'wxcc-overrides-api',
    environment: config.nodeEnv
  },
  transports: [
    new winston.transports.Console({
      format: config.nodeEnv === 'development' 
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : winston.format.json()
    })
  ]
});

// Add file transport in production
if (config.nodeEnv === 'production') {
  logger.add(new winston.transports.File({ 
    filename: 'logs/error.log', 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: 'logs/combined.log' 
  }));
}

export { logger };

// Structured logging helpers
export const logApiCall = (method: string, url: string, duration?: number, status?: number) => {
  logger.info('API Call', {
    type: 'api_call',
    method,
    url,
    duration,
    status
  });
};

export const logValidationError = (operation: string, errors: Array<{ field: string; message: string }>) => {
  logger.warn('Validation Error', {
    type: 'validation_error',
    operation,
    errors
  });
};

export const logScheduleConflict = (
  agentId: string, 
  conflictingAgentId: string, 
  containerId: string
) => {
  logger.error('Schedule Conflict', {
    type: 'schedule_conflict',
    agentId,
    conflictingAgentId,
    containerId
  });
  
  // Also log with pretty logger for better visibility
  if (typeof require !== 'undefined') {
    try {
      const { prettyLogger } = require('./prettyLogger');
      prettyLogger.scheduleConflict(agentId, conflictingAgentId, containerId);
    } catch (error) {
      // Gracefully handle if prettyLogger is not available
    }
  }
};

export const logWxccApiError = (operation: string, error: unknown, context?: any) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  // Extract detailed WxCC API error information
  let wxccErrorDetails = {};
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as any;
    wxccErrorDetails = {
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      wxccErrorMessage: axiosError.response?.data?.message || axiosError.response?.data?.error,
      wxccErrorCode: axiosError.response?.data?.code,
      wxccErrorDetails: axiosError.response?.data?.details,
      responseHeaders: axiosError.response?.headers,
      requestUrl: axiosError.config?.url,
      requestMethod: axiosError.config?.method?.toUpperCase(),
      requestBody: axiosError.config?.data
    };
  }
  
  logger.error('WxCC API Error', {
    type: 'wxcc_api_error',
    operation,
    error: errorMessage,
    stack: errorStack,
    context,
    ...wxccErrorDetails
  });
};