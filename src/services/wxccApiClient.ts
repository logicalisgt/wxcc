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
    this.client.interceptors.request.use((requestConfig) => {
      const startTime = Date.now();
      (requestConfig as any).metadata = { startTime };
      
      // Enhanced logging: Log every WxCC API endpoint being called
      const method = requestConfig.method?.toUpperCase() || 'GET';
      const fullUrl = `${requestConfig.baseURL}${requestConfig.url}`;
      
      logger.info('WxCC API Call Starting', {
        type: 'wxcc_api_call_start',
        method,
        url: requestConfig.url,
        fullUrl,
        operation: this.getOperationNameFromUrl(requestConfig.url || ''),
        timestamp: new Date().toISOString()
      });
      
      return requestConfig;
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        const endTime = Date.now();
        const startTime = (response.config as any).metadata?.startTime || endTime;
        const duration = endTime - startTime;
        
        const method = response.config.method?.toUpperCase() || 'GET';
        const fullUrl = `${response.config.baseURL}${response.config.url}`;
        
        // Enhanced logging with full details
        logger.info('WxCC API Call Completed', {
          type: 'wxcc_api_call_success',
          method,
          url: response.config.url,
          fullUrl,
          duration,
          status: response.status,
          operation: this.getOperationNameFromUrl(response.config.url || ''),
          timestamp: new Date().toISOString()
        });
        
        // Also maintain backward compatibility with existing logApiCall
        logApiCall(method, fullUrl, duration, response.status);
        
        return response;
      },
      (error) => {
        const endTime = Date.now();
        const startTime = error.config?.metadata?.startTime || endTime;
        const duration = endTime - startTime;
        
        const method = error.config?.method?.toUpperCase() || 'GET';
        const fullUrl = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
        
        // Enhanced error logging
        logger.error('WxCC API Call Failed', {
          type: 'wxcc_api_call_error',
          method,
          url: error.config?.url,
          fullUrl,
          duration,
          status: error.response?.status,
          operation: this.getOperationNameFromUrl(error.config?.url || ''),
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Also maintain backward compatibility
        logApiCall(method, fullUrl, duration, error.response?.status);
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Helper method to extract operation name from URL for logging
   */
  private getOperationNameFromUrl(url: string): string {
    if (url.includes('/v2/overrides') && !url.includes('/overrides/')) return 'list_overrides';
    if (url.includes('/overrides/') && url.split('/').length > 4) return 'get_override_by_id';
    if (url.includes('/overrides/') && url.split('/').length === 4) return 'update_override_by_id';
    return 'unknown_operation';
  }

  /**
   * Fetch all override containers using List API
   * 
   * Official WxCC API Documentation:
   * Endpoint: GET https://api.wxcc-eu2.cisco.com/organization/{org-id}/v2/overrides
   * Reference: WxCC Overrides API v2 - List Overrides resources
   */
  async listOverrideContainers(): Promise<WxccOverrideContainer[]> {
    try {
      logger.info('Fetching override containers', { operation: 'list_containers' });
      
      // Use official WxCC API endpoint for List Overrides resources
      const endpoint = `/organization/${config.wxcc.organizationId}/v2/overrides`;
      const response: AxiosResponse<{ items: WxccOverrideContainer[] }> = await this.client.get(endpoint);

      // Debug logging: Log raw API response data for diagnosis
      logger.info('WxCC API raw response received', { 
        operation: 'list_containers',
        rawResponseData: response.data,
        statusCode: response.status,
        headers: response.headers
      });

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
   * 
   * Official WxCC API Documentation:
   * Endpoint: GET https://api.wxcc-eu2.cisco.com/organization/{org-id}/overrides/{id}
   * Reference: WxCC Overrides API - Get specific Overrides resource by ID
   */
  async getOverrideContainerById(containerId: string): Promise<WxccOverrideContainer> {
    try {
      logger.info('Fetching container details', { 
        operation: 'get_container_by_id',
        containerId 
      });

      // Use official WxCC API endpoint for Get specific Overrides resource by ID
      const endpoint = `/organization/${config.wxcc.organizationId}/overrides/${containerId}`;
      const response: AxiosResponse<WxccOverrideContainer> = await this.client.get(endpoint);

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
   * 
   * Official WxCC API Documentation:
   * Endpoint: PUT https://api.wxcc-eu2.cisco.com/organization/{org-id}/overrides/{id}
   * Reference: WxCC Overrides API - Update specific Overrides resource by ID
   * 
   * TODO: Team review needed - The official API documentation shows updating by override ID,
   * but our current implementation expects containerId and agentId. Need to clarify the
   * correct mapping between our internal model and the official API structure.
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

      // Use official WxCC API endpoint for Update specific Overrides resource by ID
      // Note: Using containerId as the override ID - may need team review for correct mapping
      const endpoint = `/organization/${config.wxcc.organizationId}/overrides/${containerId}`;
      const response: AxiosResponse<WxccOverride> = await this.client.put(endpoint, overrideData);

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