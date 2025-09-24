import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { WxccOverrideContainer, WxccOverride } from '../types';
import { config } from '../config';
import { logger, logApiCall, logWxccApiError } from '../utils/logger';

export class WxccApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.wxcc.baseUrl,
      timeout: config.wxcc.timeout,
      headers: {
        'Authorization': `Bearer ${config.wxcc.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use((config) => {
      const startTime = Date.now();
      (config as any).metadata = { startTime };
      return config;
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        const endTime = Date.now();
        const startTime = (response.config as any).metadata?.startTime || endTime;
        const duration = endTime - startTime;
        
        logApiCall(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          duration,
          response.status
        );
        
        return response;
      },
      (error) => {
        const endTime = Date.now();
        const startTime = error.config?.metadata?.startTime || endTime;
        const duration = endTime - startTime;
        
        logApiCall(
          error.config?.method?.toUpperCase() || 'GET',
          error.config?.url || '',
          duration,
          error.response?.status
        );
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch all override containers using List API
   */
  async listOverrideContainers(): Promise<WxccOverrideContainer[]> {
    try {
      logger.info('Fetching override containers', { operation: 'list_containers' });
      
      const response: AxiosResponse<{ items: WxccOverrideContainer[] }> = await this.client.get(
        '/telephony/config/override-containers'
      );

      const containers = response.data.items || [];
      logger.info('Successfully fetched containers', { 
        operation: 'list_containers',
        count: containers.length 
      });

      return containers;
    } catch (error) {
      logWxccApiError('list_containers', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch override containers: ${errorMessage}`);
    }
  }

  /**
   * Get specific override container details by ID, including sub-overrides (agents)
   */
  async getOverrideContainerById(containerId: string): Promise<WxccOverrideContainer> {
    try {
      logger.info('Fetching container details', { 
        operation: 'get_container_by_id',
        containerId 
      });

      const response: AxiosResponse<WxccOverrideContainer> = await this.client.get(
        `/telephony/config/override-containers/${containerId}`
      );

      const container = response.data;
      logger.info('Successfully fetched container details', {
        operation: 'get_container_by_id',
        containerId,
        overrideCount: container.overrides?.length || 0
      });

      return container;
    } catch (error) {
      logWxccApiError('get_container_by_id', error, { containerId });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch container ${containerId}: ${errorMessage}`);
    }
  }

  /**
   * Update an override/agent within a container
   */
  async updateOverride(
    containerId: string, 
    agentId: string, 
    overrideData: Partial<WxccOverride>
  ): Promise<WxccOverride> {
    try {
      logger.info('Updating agent override', {
        operation: 'update_override',
        containerId,
        agentId,
        updateData: overrideData
      });

      const response: AxiosResponse<WxccOverride> = await this.client.put(
        `/telephony/config/override-containers/${containerId}/overrides/${agentId}`,
        overrideData
      );

      logger.info('Successfully updated agent override', {
        operation: 'update_override',
        containerId,
        agentId
      });

      return response.data;
    } catch (error) {
      logWxccApiError('update_override', error, { containerId, agentId, overrideData });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to update agent ${agentId} in container ${containerId}: ${errorMessage}`);
    }
  }

  /**
   * Retry mechanism for failed API calls
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries = config.api.retryAttempts
  ): Promise<T> {
    let lastError: Error = new Error('No attempts made');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('API operation failed, retrying', {
          operation: operationName,
          attempt,
          maxRetries,
          error: errorMessage
        });

        if (attempt < maxRetries) {
          await this.delay(config.api.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    logger.error('API operation failed after all retries', {
      operation: operationName,
      maxRetries,
      finalError: lastError.message
    });

    throw lastError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const wxccApiClient = new WxccApiClient();