import { isAfter, isBefore, parseISO, isWithinInterval } from 'date-fns';
import {
  Agent,
  AgentStatus,
  OverrideContainer,
  WxccOverrideContainer,
  ValidationResult,
  ScheduleValidationError,
  UpdateAgentRequest,
  ContainerResponse,
  AgentResponse
} from '../types';
import { wxccApiClient } from './wxccApiClient';
import { logger, logValidationError, logScheduleConflict } from '../utils/logger';

export class OverrideService {
  
  /**
   * Fetch all containers with their agents from WxCC API
   */
  async getAllContainersWithAgents(): Promise<OverrideContainer[]> {
    try {
      logger.info('Fetching all containers with agents', { operation: 'get_all_containers' });

      // First, get all container basic info
      const containerList = await wxccApiClient.listOverrideContainers();
      
      // Then, fetch detailed info for each container to get sub-overrides (agents)
      const containersWithAgents: OverrideContainer[] = [];
      
      for (const containerBasic of containerList) {
        try {
          const containerDetail = await wxccApiClient.getOverrideContainerById(containerBasic.id);
          const agents = this.mapWxccOverridesToAgents(containerDetail);
          
          containersWithAgents.push({
            id: containerDetail.id,
            name: containerDetail.name,
            description: containerDetail.description,
            createdAt: containerDetail.createdTime,
            updatedAt: containerDetail.lastModifiedTime,
            agents
          });
          
          logger.info('Processed container', {
            containerId: containerDetail.id,
            agentCount: agents.length
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Failed to fetch container details', {
            containerId: containerBasic.id,
            error: errorMessage
          });
          // Continue with other containers even if one fails
        }
      }

      logger.info('Successfully fetched all containers', {
        operation: 'get_all_containers',
        containerCount: containersWithAgents.length
      });

      return containersWithAgents;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch containers with agents', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get a specific container with its agents
   */
  async getContainerById(containerId: string): Promise<OverrideContainer> {
    try {
      logger.info('Fetching container by ID', { containerId, operation: 'get_container_by_id' });

      const containerDetail = await wxccApiClient.getOverrideContainerById(containerId);
      const agents = this.mapWxccOverridesToAgents(containerDetail);

      return {
        id: containerDetail.id,
        name: containerDetail.name,
        description: containerDetail.description,
        createdAt: containerDetail.createdTime,
        updatedAt: containerDetail.lastModifiedTime,
        agents
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch container by ID', { containerId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Update an agent's schedule with validation
   */
  async updateAgentSchedule(
    containerId: string,
    agentId: string,
    updateData: UpdateAgentRequest
  ): Promise<Agent> {
    try {
      logger.info('Updating agent schedule', {
        operation: 'update_agent_schedule',
        containerId,
        agentId,
        updateData
      });

      // Validate the schedule update
      const validationResult = await this.validateAgentScheduleUpdate(containerId, agentId, updateData);
      
      if (!validationResult.isValid) {
        logValidationError('update_agent_schedule', validationResult.errors);
        throw new Error(`Validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      // Update via WxCC API
      const updatedOverride = await wxccApiClient.updateOverride(containerId, agentId, {
        name: agentId,
        workingHours: updateData.workingHours,
        startDateTime: updateData.startDateTime,
        endDateTime: updateData.endDateTime
      });

      // Fetch container details to get container name
      const container = await wxccApiClient.getOverrideContainerById(containerId);
      
      const updatedAgent: Agent = {
        agentId: updatedOverride.name,
        containerId,
        containerName: container.name,
        workingHours: updatedOverride.workingHours,
        startDateTime: updatedOverride.startDateTime,
        endDateTime: updatedOverride.endDateTime,
        status: this.determineAgentStatus(updatedOverride.startDateTime, updatedOverride.endDateTime, updatedOverride.workingHours)
      };

      logger.info('Successfully updated agent schedule', {
        containerId,
        agentId,
        status: updatedAgent.status
      });

      return updatedAgent;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update agent schedule', {
        containerId,
        agentId,
        error: errorMessage
      });
      throw error;
    }
  }

  /**
   * Get currently active agents across all containers
   */
  async getActiveAgents(): Promise<AgentResponse[]> {
    try {
      logger.info('Fetching currently active agents', { operation: 'get_active_agents' });

      const containers = await this.getAllContainersWithAgents();
      const activeAgents: AgentResponse[] = [];
      const now = new Date();

      for (const container of containers) {
        for (const agent of container.agents) {
          if (this.isAgentCurrentlyActive(agent, now)) {
            activeAgents.push(this.mapAgentToResponse(agent, true));
          }
        }
      }

      logger.info('Found active agents', {
        operation: 'get_active_agents',
        activeCount: activeAgents.length
      });

      return activeAgents;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to fetch active agents', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Convert container data to frontend-friendly format
   */
  async getContainerForFrontend(containerId: string): Promise<ContainerResponse> {
    const container = await this.getContainerById(containerId);
    const now = new Date();

    const agents = container.agents.map(agent => this.mapAgentToResponse(agent, this.isAgentCurrentlyActive(agent, now)));
    const activeAgents = agents.filter(agent => agent.isCurrentlyActive);

    return {
      id: container.id,
      name: container.name,
      description: container.description,
      agents,
      activeAgents,
      totalAgents: agents.length,
      activeCount: activeAgents.length
    };
  }

  /**
   * Validate agent schedule update for overlapping schedules
   */
  private async validateAgentScheduleUpdate(
    containerId: string,
    agentId: string,
    updateData: UpdateAgentRequest
  ): Promise<ValidationResult> {
    const errors: ScheduleValidationError[] = [];

    // Validate date format and logic
    try {
      const startDate = parseISO(updateData.startDateTime);
      const endDate = parseISO(updateData.endDateTime);

      if (isAfter(startDate, endDate)) {
        errors.push({
          field: 'startDateTime',
          message: 'Start date must be before end date',
          agentId
        });
      }

      if (isBefore(endDate, new Date())) {
        errors.push({
          field: 'endDateTime',
          message: 'End date cannot be in the past',
          agentId
        });
      }
    } catch (error) {
      errors.push({
        field: 'dateTime',
        message: 'Invalid date format. Use ISO 8601 format',
        agentId
      });
    }

    // If workingHours is true, check for overlapping schedules with other active agents
    if (updateData.workingHours) {
      const container = await this.getContainerById(containerId);
      const conflictingAgent = this.findScheduleConflict(container.agents, agentId, updateData);

      if (conflictingAgent) {
        logScheduleConflict(agentId, conflictingAgent.agentId, containerId);
        errors.push({
          field: 'schedule',
          message: `Schedule conflicts with agent ${conflictingAgent.agentId}`,
          agentId,
          conflictingAgentId: conflictingAgent.agentId
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Find schedule conflicts with other active agents
   */
  private findScheduleConflict(
    existingAgents: Agent[],
    updatingAgentId: string,
    updateData: UpdateAgentRequest
  ): Agent | null {
    const updateStart = parseISO(updateData.startDateTime);
    const updateEnd = parseISO(updateData.endDateTime);

    for (const agent of existingAgents) {
      // Skip the agent being updated
      if (agent.agentId === updatingAgentId) continue;
      
      // Only check conflicts with agents that have workingHours: true
      if (!agent.workingHours) continue;

      const agentStart = parseISO(agent.startDateTime);
      const agentEnd = parseISO(agent.endDateTime);

      // Check for overlap: schedules overlap if one starts before the other ends
      const hasOverlap = 
        isBefore(updateStart, agentEnd) && isAfter(updateEnd, agentStart);

      if (hasOverlap) {
        return agent;
      }
    }

    return null;
  }

  /**
   * Map WxCC overrides to internal Agent format
   */
  private mapWxccOverridesToAgents(container: WxccOverrideContainer): Agent[] {
    if (!container.overrides) return [];

    return container.overrides.map(override => ({
      agentId: override.name,
      containerId: container.id,
      containerName: container.name,
      workingHours: override.workingHours,
      startDateTime: override.startDateTime,
      endDateTime: override.endDateTime,
      status: this.determineAgentStatus(override.startDateTime, override.endDateTime, override.workingHours)
    }));
  }

  /**
   * Determine agent status based on schedule and working hours
   */
  private determineAgentStatus(startDateTime: string, endDateTime: string, workingHours: boolean): AgentStatus {
    const now = new Date();
    const start = parseISO(startDateTime);
    const end = parseISO(endDateTime);

    if (!workingHours) {
      return AgentStatus.INACTIVE;
    }

    if (isBefore(now, start)) {
      return AgentStatus.SCHEDULED;
    }

    if (isAfter(now, end)) {
      return AgentStatus.EXPIRED;
    }

    return AgentStatus.ACTIVE;
  }

  /**
   * Check if agent is currently active
   */
  private isAgentCurrentlyActive(agent: Agent, currentTime: Date): boolean {
    if (!agent.workingHours) return false;
    
    try {
      const start = parseISO(agent.startDateTime);
      const end = parseISO(agent.endDateTime);
      
      return isWithinInterval(currentTime, { start, end });
    } catch {
      return false;
    }
  }

  /**
   * Map Agent to AgentResponse for frontend consumption
   */
  private mapAgentToResponse(agent: Agent, isCurrentlyActive: boolean): AgentResponse {
    return {
      agentId: agent.agentId,
      containerId: agent.containerId,
      containerName: agent.containerName,
      workingHours: agent.workingHours,
      startDateTime: agent.startDateTime,
      endDateTime: agent.endDateTime,
      status: agent.status,
      isCurrentlyActive
    };
  }

  /**
   * Public method for validating schedule conflicts for external use
   */
  async validateScheduleConflictForOverride(
    overrideName: string,
    containerId: string,
    updateData: UpdateAgentRequest
  ): Promise<ValidationResult> {
    return this.validateAgentScheduleUpdate(containerId, overrideName, updateData);
  }
}

export const overrideService = new OverrideService();