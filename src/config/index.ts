import { WxccApiConfig } from '../types';

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // WxCC API Configuration
  wxcc: {
    baseUrl: process.env.WXCC_API_BASE_URL || 'https://api.wxcc-eu2.cisco.com',
    accessToken: process.env.WXCC_ACCESS_TOKEN || '',
    organizationId: process.env.WXCC_ORG_ID || '',
    timeout: parseInt(process.env.WXCC_API_TIMEOUT || '30000')
  } as WxccApiConfig,

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    prettyLogs: process.env.PRETTY_LOGS === 'true' || process.env.NODE_ENV === 'development'
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
  // In development mode, allow missing WxCC credentials (will use mock data)
  if (config.nodeEnv === 'development') {
    if (!config.wxcc.accessToken) {
      console.warn('Warning: WXCC_ACCESS_TOKEN not provided in development mode. Using mock data.');
    }
    if (!config.wxcc.organizationId) {
      console.warn('Warning: WXCC_ORG_ID not provided in development mode. Using mock data.');
    }
    return;
  }
  
  if (!config.wxcc.accessToken) {
    throw new Error('WXCC_ACCESS_TOKEN environment variable is required');
  }
  
  if (!config.wxcc.organizationId) {
    throw new Error('WXCC_ORG_ID environment variable is required');
  }
  
  if (!config.wxcc.baseUrl) {
    throw new Error('WXCC_API_BASE_URL environment variable is required');
  }
};