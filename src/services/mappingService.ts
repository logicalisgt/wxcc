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
      const mappings = databaseService.getAllMappings();
      
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
        const cleanedCount = databaseService.cleanupOrphanedMappings(activeOverrideNames);
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

      // Validate that the override name exists in WxCC
      await this.validateOverrideExists(request.overrideName);

      // Create/update the mapping
      const mapping = databaseService.upsertMapping(request);

      // Get WxCC context for response
      const wxccAgent = await this.getWxccAgentByOverrideName(request.overrideName);

      return {
        overrideName: mapping.overrideName,
        agentName: mapping.agentName,
        workingHoursActive: mapping.workingHoursActive,
        isMapped: true,
        startDateTime: wxccAgent?.startDateTime,
        endDateTime: wxccAgent?.endDateTime,
        containerId: wxccAgent?.containerId,
        containerName: wxccAgent?.containerName
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create/update mapping', { 
        overrideName: request.overrideName, 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Toggle working hours for a mapped override with overlap validation
   */
  async updateWorkingHours(request: WorkingHoursToggleRequest): Promise<OverrideMappingResponse> {
    try {
      logger.info('Updating working hours status', { 
        overrideName: request.overrideName,
        workingHoursActive: request.workingHoursActive 
      });

      // Check if mapping exists
      const existingMapping = databaseService.getMapping(request.overrideName);
      if (!existingMapping) {
        throw new Error(`No mapping found for override name: ${request.overrideName}`);
      }

      // If enabling working hours, check for schedule conflicts
      if (request.workingHoursActive) {
        const validationResult = await this.validateWorkingHoursActivation(request.overrideName);
        if (!validationResult.isValid) {
          const errorMessages = validationResult.errors.map(e => e.message).join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }
      }

      // Update working hours status
      const updatedMapping = databaseService.updateWorkingHours(
        request.overrideName, 
        request.workingHoursActive
      );

      if (!updatedMapping) {
        throw new Error('Failed to update working hours status');
      }

      // Get WxCC context for response
      const wxccAgent = await this.getWxccAgentByOverrideName(request.overrideName);

      return {
        overrideName: updatedMapping.overrideName,
        agentName: updatedMapping.agentName,
        workingHoursActive: updatedMapping.workingHoursActive,
        isMapped: true,
        startDateTime: wxccAgent?.startDateTime,
        endDateTime: wxccAgent?.endDateTime,
        containerId: wxccAgent?.containerId,
        containerName: wxccAgent?.containerName
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update working hours', { 
        overrideName: request.overrideName, 
        error: errorMessage 
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

      // Get the container to check for conflicts with existing agents
      const container = await overrideService.getContainerById(targetAgent.containerId);
      
      // Use existing validation logic from overrideService
      // Create a mock update request to leverage existing validation
      const mockUpdateRequest = {
        workingHours: true,
        startDateTime: targetAgent.startDateTime,
        endDateTime: targetAgent.endDateTime
      };

      // Use private method access pattern similar to existing code
      const validationResult = await (overrideService as any).validateAgentScheduleUpdate(
        targetAgent.containerId,
        overrideName,
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