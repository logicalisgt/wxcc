import { databaseService } from './databaseService';
import { overrideService } from './overrideService';
import { 
  OverrideMappingResponse, 
  MappingRequest, 
  WorkingHoursToggleRequest,
  Agent,
  ValidationResult,
  ScheduleValidationError
} from '../types';
import { logger } from '../utils/logger';
import { prettyLogger } from '../utils/prettyLogger';

export class MappingService {
  
  /**
   * Get all override mappings with WxCC data context
   */
  async getAllMappings(): Promise<OverrideMappingResponse[]> {
    try {
      logger.info('Fetching all override mappings', { operation: 'get_all_mappings' });

      // Get all containers and their agents from WxCC
      const containers = await overrideService.getAllContainersWithAgents();
      
      // Collect all unique override names from WxCC
      const wxccOverrides = new Map<string, Agent>();
      for (const container of containers) {
        for (const agent of container.agents) {
          wxccOverrides.set(agent.agentId, agent);
        }
      }

      // Get all mappings from database
      const mappings = await databaseService.getAllMappings();
      
      // Create mapping lookup for performance
      const mappingLookup = new Map(
        mappings.map(m => [m.overrideName, m])
      );

      // Build response with all WxCC overrides
      const responses: OverrideMappingResponse[] = [];
      
      for (const [overrideName, agent] of wxccOverrides.entries()) {
        const mapping = mappingLookup.get(overrideName);
        
        responses.push({
          overrideName,
          agentName: mapping?.agentName || null,
          workingHoursActive: mapping?.workingHoursActive || false,
          isMapped: !!mapping,
          startDateTime: agent.startDateTime,
          endDateTime: agent.endDateTime,
          containerId: agent.containerId,
          containerName: agent.containerName
        });
      }

      // Clean up orphaned mappings
      const activeOverrideNames = Array.from(wxccOverrides.keys());
      if (activeOverrideNames.length > 0) {
        const cleanedCount = await databaseService.cleanupOrphanedMappings(activeOverrideNames);
        if (cleanedCount > 0) {
          logger.info('Cleaned up orphaned mappings during fetch', { cleanedCount });
        }
      }

      logger.info('Successfully fetched all mappings', { 
        totalOverrides: responses.length,
        mappedCount: responses.filter(r => r.isMapped).length
      });

      return responses.sort((a, b) => a.overrideName.localeCompare(b.overrideName));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get all mappings', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Create or update an agent mapping
   */
  async createOrUpdateMapping(request: MappingRequest): Promise<OverrideMappingResponse> {
    try {
      logger.info('Creating/updating agent mapping', { 
        overrideName: request.overrideName,
        agentName: request.agentName 
      });

      prettyLogger.mappingOperation('CREATE_OR_UPDATE', request.overrideName, {
        agentName: request.agentName,
        operation: 'mapping_creation'
      });

      // Validate that the override name exists in WxCC
      prettyLogger.info('Validating override exists in WxCC', {
        overrideName: request.overrideName
      });
      
      await this.validateOverrideExists(request.overrideName);
      prettyLogger.success('Override validation passed', {
        overrideName: request.overrideName
      });

      // Get current state before update
      const beforeMapping = await databaseService.getMapping(request.overrideName);

      // Create/update the mapping
      const mapping = await databaseService.upsertMapping(request);

      // Get WxCC context for response
      const wxccAgent = await this.getWxccAgentByOverrideName(request.overrideName);

      const response = {
        overrideName: mapping.overrideName,
        agentName: mapping.agentName,
        workingHoursActive: mapping.workingHoursActive,
        isMapped: true,
        startDateTime: wxccAgent?.startDateTime,
        endDateTime: wxccAgent?.endDateTime,
        containerId: wxccAgent?.containerId,
        containerName: wxccAgent?.containerName
      };

      prettyLogger.mappingOperation('CREATE_OR_UPDATE_COMPLETED', request.overrideName, {
        wasUpdate: beforeMapping !== null,
        before: beforeMapping,
        after: response,
        wxccContext: wxccAgent ? {
          containerId: wxccAgent.containerId,
          containerName: wxccAgent.containerName,
          startDateTime: wxccAgent.startDateTime,
          endDateTime: wxccAgent.endDateTime
        } : null
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create/update mapping', { 
        overrideName: request.overrideName, 
        error: errorMessage 
      });
      
      prettyLogger.error('Mapping operation failed', {
        operation: 'createOrUpdateMapping',
        overrideName: request.overrideName,
        agentName: request.agentName,
        error: errorMessage
      });
      
      throw error;
    }
  }

  /**
   * Toggle working hours for a mapped override with overlap validation
   */
  async updateWorkingHours(request: WorkingHoursToggleRequest): Promise<OverrideMappingResponse> {
    let beforeState: boolean | null = null;
    let operationContext: any = {};
    let validationErrors: string[] = [];
    
    try {
      // Initial logging - operation start
      logger.info('Starting working hours toggle operation', { 
        operation: 'update_working_hours',
        overrideName: request.overrideName,
        requestedState: request.workingHoursActive,
        timestamp: new Date().toISOString()
      });

      // Check if mapping exists and get current state
      const existingMapping = await databaseService.getMapping(request.overrideName);
      if (!existingMapping) {
        const error = `No mapping found for override name: ${request.overrideName}`;
        logger.error('Working hours toggle failed - mapping not found', { 
          overrideName: request.overrideName,
          error,
          operation: 'update_working_hours'
        });
        
        prettyLogger.error('Mapping not found for working hours toggle', {
          operation: 'updateWorkingHours',
          overrideName: request.overrideName,
          error
        });
        
        throw new Error(error);
      }

      // Capture before state for logging
      beforeState = existingMapping.workingHoursActive;
      
      // Build operation context
      operationContext = {
        overrideName: request.overrideName,
        agentName: existingMapping.agentName,
        beforeState,
        requestedState: request.workingHoursActive,
        mappingId: existingMapping.id,
        timestamp: new Date().toISOString()
      };

      // If enabling working hours, check for schedule conflicts
      if (request.workingHoursActive) {
        logger.info('Validating schedule conflicts for working hours activation', {
          overrideName: request.overrideName,
          operation: 'schedule_validation'
        });

        const validationResult = await this.validateWorkingHoursActivation(request.overrideName);
        if (!validationResult.isValid) {
          validationErrors = validationResult.errors.map(e => e.message);
          const errorMessages = validationErrors.join(', ');
          
          // Enhanced validation error logging
          logger.error('Working hours validation failed', { 
            overrideName: request.overrideName,
            validationErrors,
            errorCount: validationErrors.length,
            operation: 'update_working_hours'
          });
          
          // Pretty log validation errors
          prettyLogger.workingHoursToggle(
            request.overrideName,
            beforeState,
            request.workingHoursActive,
            operationContext,
            validationErrors
          );
          
          throw new Error(`Validation failed: ${errorMessages}`);
        }
      }

      // Get WxCC context for enhanced logging
      const wxccAgent = await this.getWxccAgentByOverrideName(request.overrideName);
      if (wxccAgent) {
        operationContext.wxccContext = {
          containerId: wxccAgent.containerId,
          containerName: wxccAgent.containerName,
          startDateTime: wxccAgent.startDateTime,
          endDateTime: wxccAgent.endDateTime
        };
      }

      // Update working hours status
      const updatedMapping = await databaseService.updateWorkingHours(
        request.overrideName, 
        request.workingHoursActive
      );

      if (!updatedMapping) {
        const error = 'Failed to update working hours status in database';
        logger.error('Database update failed for working hours', { 
          overrideName: request.overrideName,
          error,
          operation: 'update_working_hours'
        });
        throw new Error(error);
      }

      // Build response
      const response = {
        overrideName: updatedMapping.overrideName,
        agentName: updatedMapping.agentName,
        workingHoursActive: updatedMapping.workingHoursActive,
        isMapped: true,
        startDateTime: wxccAgent?.startDateTime,
        endDateTime: wxccAgent?.endDateTime,
        containerId: wxccAgent?.containerId,
        containerName: wxccAgent?.containerName
      };

      // Success logging - both JSON and pretty logs
      logger.info('Working hours toggle completed successfully', { 
        operation: 'update_working_hours',
        overrideName: request.overrideName,
        beforeState,
        afterState: updatedMapping.workingHoursActive,
        agentName: updatedMapping.agentName,
        result: response,
        operationContext
      });

      // Pretty log successful toggle
      prettyLogger.workingHoursToggle(
        request.overrideName,
        beforeState!,
        updatedMapping.workingHoursActive,
        {
          ...operationContext,
          success: true,
          agentName: updatedMapping.agentName
        }
      );

      return response;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Enhanced error logging - both JSON and pretty logs
      logger.error('Working hours toggle operation failed', { 
        operation: 'update_working_hours',
        overrideName: request.overrideName,
        beforeState,
        requestedState: request.workingHoursActive,
        error: errorMessage,
        operationContext,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined
      });
      
      prettyLogger.error('Working hours toggle failed', {
        operation: 'updateWorkingHours',
        overrideName: request.overrideName,
        beforeState,
        requestedState: request.workingHoursActive,
        error: errorMessage,
        context: operationContext
      });
      
      throw error;
    }
  }

  /**
   * Validate that an override name exists in WxCC
   */
  private async validateOverrideExists(overrideName: string): Promise<void> {
    const containers = await overrideService.getAllContainersWithAgents();
    
    for (const container of containers) {
      for (const agent of container.agents) {
        if (agent.agentId === overrideName) {
          return; // Found it
        }
      }
    }
    
    throw new Error(`Override name '${overrideName}' not found in WxCC`);
  }

  /**
   * Get WxCC agent data by override name
   */
  private async getWxccAgentByOverrideName(overrideName: string): Promise<Agent | null> {
    try {
      const containers = await overrideService.getAllContainersWithAgents();
      
      for (const container of containers) {
        for (const agent of container.agents) {
          if (agent.agentId === overrideName) {
            return agent;
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.warn('Failed to get WxCC agent data', { overrideName });
      return null;
    }
  }

  /**
   * Validate working hours activation for schedule conflicts
   */
  private async validateWorkingHoursActivation(overrideName: string): Promise<ValidationResult> {
    try {
      // Get the WxCC agent data for the override being activated
      const targetAgent = await this.getWxccAgentByOverrideName(overrideName);
      if (!targetAgent) {
        return {
          isValid: false,
          errors: [{
            field: 'overrideName',
            message: `Override '${overrideName}' not found in WxCC`,
            agentId: overrideName
          }]
        };
      }

      // Create a mock update request to leverage existing validation
      const mockUpdateRequest = {
        workingHours: true,
        startDateTime: targetAgent.startDateTime,
        endDateTime: targetAgent.endDateTime
      };

      // Use the public validation method from overrideService
      const validationResult = await overrideService.validateScheduleConflictForOverride(
        overrideName,
        targetAgent.containerId,
        mockUpdateRequest
      );

      return validationResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        isValid: false,
        errors: [{
          field: 'validation',
          message: `Validation error: ${errorMessage}`,
          agentId: overrideName
        }]
      };
    }
  }
}

// Export singleton instance
export const mappingService = new MappingService();