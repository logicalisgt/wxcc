import { WxccApiConfig } from '../types';

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // WxCC API Configuration
  wxcc: {
    baseUrl: process.env.WXCC_API_BASE_URL || 'https://your-wxcc-instance.cisco.com/',
    accessToken: process.env.WXCC_ACCESS_TOKEN || '',
    timeout: parseInt(process.env.WXCC_API_TIMEOUT || '30000')
  } as WxccApiConfig,

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },

  // API rate limiting and retry configuration
  api: {
    retryAttempts: parseInt(process.env.API_RETRY_ATTEMPTS || '3'),
    retryDelay: parseInt(process.env.API_RETRY_DELAY || '1000'),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100')
  }
};

export const validateConfig = (): void => {
  if (!config.wxcc.accessToken) {
    throw new Error('WXCC_ACCESS_TOKEN environment variable is required');
  }
  
  if (!config.wxcc.baseUrl) {
    throw new Error('WXCC_API_BASE_URL environment variable is required');
  }
};