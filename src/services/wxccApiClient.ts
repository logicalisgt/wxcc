import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { WxccOverrideContainer, WxccOverride } from '../types';
import { config } from '../config';
import { logger, logApiCall, logWxccApiError } from '../utils/logger';
import { prettyLogger } from '../utils/prettyLogger';
import { toWxccFormat } from '../utils/dateFormat';

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
        requestBody: requestConfig.data,
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
          responseBody: response.data,
          timestamp: new Date().toISOString()
        });
        
        // Pretty logging for development
        prettyLogger.apiCall({
          operation: this.getOperationNameFromUrl(response.config.url || ''),
          method,
          url: fullUrl,
          requestBody: response.config.data,
          responseBody: response.data,
          duration,
          status: response.status
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
          requestBody: error.config?.data,
          responseBody: error.response?.data,
          responseHeaders: error.response?.headers,
          timestamp: new Date().toISOString()
        });
        
        // Pretty error logging
        prettyLogger.error('WxCC API call failed', {
          operation: this.getOperationNameFromUrl(error.config?.url || ''),
          method,
          url: fullUrl,
          status: error.response?.status,
          error: error.message,
          duration
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
      const response: AxiosResponse<{ 
        data?: WxccOverrideContainer[]; 
        items?: WxccOverrideContainer[] 
      }> = await this.client.get(endpoint);

      // Debug logging: Log raw API response data for diagnosis
      logger.info('WxCC API raw response received', { 
        operation: 'list_containers',
        rawResponseData: response.data,
        statusCode: response.status,
        headers: response.headers
      });

      const containers = response.data.data || response.data.items || [];
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
   * Multi-step workflow as per WxCC API contract:
   * 1. Fetch the full container details including all overrides
   * 2. Construct the complete override container object with all required fields
   * 3. Update only the relevant override inside the overrides array
   * 4. Send the complete container object as PUT request body
   */
  async updateOverride(
    containerId: string, 
    agentId: string, 
    overrideData: Partial<WxccOverride>
  ): Promise<WxccOverride> {
    try {
      logger.info('Starting override update workflow', {
        operation: 'update_override',
        containerId,
        agentId,
        updateData: overrideData
      });

      // Step 1: Fetch the full container details including all overrides
      logger.info('Fetching full container details for update', {
        operation: 'update_override_step1',
        containerId
      });
      
      const fullContainer = await this.getOverrideContainerById(containerId);
      
      if (!fullContainer.overrides) {
        fullContainer.overrides = [];
      }

      // Step 2: Find the specific override to update by name (agentId maps to override.name)
      const overrideIndex = fullContainer.overrides.findIndex(override => override.name === agentId);
      
      if (overrideIndex === -1) {
        throw new Error(`Override with name '${agentId}' not found in container ${containerId}`);
      }

      // Step 3: Update only the relevant override, preserving all other overrides
      // Ensure date formats are in WxCC format before updating
      const updatedOverride: WxccOverride = {
        ...fullContainer.overrides[overrideIndex],
        ...overrideData
      };
      
      // Convert dates to WxCC format if they exist
      if (updatedOverride.startDateTime) {
        updatedOverride.startDateTime = toWxccFormat(updatedOverride.startDateTime);
      }
      if (updatedOverride.endDateTime) {
        updatedOverride.endDateTime = toWxccFormat(updatedOverride.endDateTime);
      }
      
      fullContainer.overrides[overrideIndex] = updatedOverride;

      logger.info('Updated override with WxCC formatted dates', {
        operation: 'update_override_step3',
        agentId,
        originalStartDateTime: overrideData.startDateTime,
        originalEndDateTime: overrideData.endDateTime,
        wxccStartDateTime: updatedOverride.startDateTime,
        wxccEndDateTime: updatedOverride.endDateTime
      });

      prettyLogger.info('Date format conversion completed', {
        agentId,
        originalDates: {
          start: overrideData.startDateTime,
          end: overrideData.endDateTime
        },
        wxccDates: {
          start: updatedOverride.startDateTime,
          end: updatedOverride.endDateTime
        }
      });

      // Step 4: Construct the complete override container object with all required fields
      const completeContainerPayload: WxccOverrideContainer = {
        id: fullContainer.id,
        organizationId: config.wxcc.organizationId,
        version: fullContainer.version || 1,
        name: fullContainer.name,
        description: fullContainer.description,
        timezone: fullContainer.timezone || 'UTC',
        createdTime: fullContainer.createdTime,
        lastModifiedTime: toWxccFormat(new Date()),
        overrides: fullContainer.overrides
      };

      logger.info('Sending complete container update to WxCC API', {
        operation: 'update_override_step4',
        containerId,
        agentId,
        overrideCount: completeContainerPayload.overrides?.length || 0,
        payloadSize: JSON.stringify(completeContainerPayload).length
      });

      // Step 5: Send the complete container object as PUT request
      const endpoint = `/organization/${config.wxcc.organizationId}/overrides/${containerId}`;
      const response: AxiosResponse<WxccOverrideContainer> = await this.client.put(endpoint, completeContainerPayload);

      // Extract the updated override from the response
      const responseOverride = response.data.overrides?.find(override => override.name === agentId);
      
      if (!responseOverride) {
        throw new Error(`Updated override '${agentId}' not found in response`);
      }

      logger.info('Successfully updated agent override', {
        operation: 'update_override',
        containerId,
        agentId,
        updatedFields: Object.keys(overrideData)
      });

      return responseOverride;
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