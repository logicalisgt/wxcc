import { Request, Response } from 'express';
import { overrideService } from '../services/overrideService';
import { UpdateAgentRequest } from '../types';
import { logger } from '../utils/logger';
import { mockContainers, mockActiveAgents } from '../utils/mockData';
import { config } from '../config';

export class OverrideController {

  /**
   * GET /api/overrides/containers
   * Get all override containers with their agents and status
   */
  async getAllContainers(req: Request, res: Response): Promise<void> {
    try {
      logger.info('API: Get all containers', { 
        endpoint: '/api/overrides/containers',
        method: 'GET'
      });

      // In development mode, use mock data if WxCC API is not available
      if (config.nodeEnv === 'development' && !config.wxcc.accessToken) {
        logger.info('Using mock data for development', { endpoint: '/api/overrides/containers' });
        res.json({
          success: true,
          data: mockContainers,
          count: mockContainers.length,
          mock: true
        });
        return;
      }

      const containers = await overrideService.getAllContainersWithAgents();
      
      // Convert to frontend-friendly format
      const containerResponses = await Promise.all(
        containers.map(container => 
          overrideService.getContainerForFrontend(container.id)
        )
      );

      // Debug logging: Log final data being sent to frontend for diagnosis
      logger.info('Sending container data to frontend', {
        endpoint: '/api/overrides/containers', 
        finalContainerResponses: containerResponses,
        responseCount: containerResponses.length,
        responseStructure: containerResponses.map(container => ({
          id: container.id,
          name: container.name,
          totalAgents: container.totalAgents,
          activeCount: container.activeCount,
          agentsPreview: container.agents?.slice(0, 2) // Preview first 2 agents for structure
        }))
      });

      res.json({
        success: true,
        data: containerResponses,
        count: containerResponses.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // In development mode, fall back to mock data on API error
      if (config.nodeEnv === 'development') {
        logger.warn('API failed, using mock data for development', {
          endpoint: '/api/overrides/containers',
          error: errorMessage
        });
        res.json({
          success: true,
          data: mockContainers,
          count: mockContainers.length,
          mock: true,
          warning: 'Using mock data - WxCC API not available'
        });
        return;
      }

      logger.error('Failed to get all containers', {
        endpoint: '/api/overrides/containers',
        error: errorMessage
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch containers',
        message: errorMessage
      });
    }
  }

  /**
   * GET /api/overrides/containers/:id
   * Get specific container details with agents
   */
  async getContainerById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      logger.info('API: Get container by ID', {
        endpoint: `/api/overrides/containers/${id}`,
        method: 'GET',
        containerId: id
      });

      const containerResponse = await overrideService.getContainerForFrontend(id);

      res.json({
        success: true,
        data: containerResponse
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get container by ID', {
        endpoint: `/api/overrides/containers/${req.params.id}`,
        containerId: req.params.id,
        error: errorMessage
      });

      if (errorMessage.includes('Failed to fetch container')) {
        res.status(404).json({
          success: false,
          error: 'Container not found',
          message: errorMessage
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch container',
          message: errorMessage
        });
      }
    }
  }

  /**
   * PUT /api/overrides/containers/:containerId/agents/:agentId
   * Update agent schedule with validation
   */
  async updateAgentSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { containerId, agentId } = req.params;
      const updateData: UpdateAgentRequest = req.body;

      logger.info('API: Update agent schedule', {
        endpoint: `/api/overrides/containers/${containerId}/agents/${agentId}`,
        method: 'PUT',
        containerId,
        agentId,
        updateData
      });

      // Validate request body
      if (!this.isValidUpdateRequest(updateData)) {
        res.status(400).json({
          success: false,
          error: 'Invalid request data',
          message: 'workingHours, startDateTime, and endDateTime are required'
        });
        return;
      }

      // In development mode, use mock response if WxCC API is not available
      if (config.nodeEnv === 'development' && !config.wxcc.accessToken) {
        logger.info('Using mock response for development', { 
          endpoint: `/api/overrides/containers/${containerId}/agents/${agentId}` 
        });
        
        // Find the agent in mock data and simulate update
        const container = mockContainers.find(c => c.id === containerId);
        const agent = container?.agents.find(a => a.agentId === agentId);
        
        if (!agent) {
          res.status(404).json({
            success: false,
            error: 'Agent not found',
            message: `Agent ${agentId} not found in container ${containerId}`
          });
          return;
        }

        const updatedAgent = {
          ...agent,
          workingHours: updateData.workingHours,
          startDateTime: updateData.startDateTime,
          endDateTime: updateData.endDateTime
        };

        res.json({
          success: true,
          data: updatedAgent,
          message: 'Agent schedule updated successfully (mock)',
          mock: true
        });
        return;
      }

      const updatedAgent = await overrideService.updateAgentSchedule(containerId, agentId, updateData);

      res.json({
        success: true,
        data: updatedAgent,
        message: 'Agent schedule updated successfully'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // In development mode, provide mock response on API error
      if (config.nodeEnv === 'development') {
        logger.warn('API failed, using mock response for development', {
          endpoint: `/api/overrides/containers/${req.params.containerId}/agents/${req.params.agentId}`,
          error: errorMessage
        });
        
        res.json({
          success: true,
          data: {
            agentId: req.params.agentId,
            containerId: req.params.containerId,
            containerName: 'Mock Container',
            workingHours: req.body.workingHours,
            startDateTime: req.body.startDateTime,
            endDateTime: req.body.endDateTime,
            status: req.body.workingHours ? 'active' : 'inactive',
            isCurrentlyActive: false
          },
          message: 'Agent schedule updated successfully (mock - API not available)',
          mock: true,
          warning: 'Using mock response - WxCC API not available'
        });
        return;
      }

      logger.error('Failed to update agent schedule', {
        endpoint: `/api/overrides/containers/${req.params.containerId}/agents/${req.params.agentId}`,
        containerId: req.params.containerId,
        agentId: req.params.agentId,
        error: errorMessage
      });

      if (errorMessage.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          message: errorMessage
        });
      } else if (errorMessage.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Resource not found',
          message: errorMessage
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update agent schedule',
          message: errorMessage
        });
      }
    }
  }

  /**
   * GET /api/overrides/active
   * Get currently active agents across all containers
   */
  async getActiveAgents(req: Request, res: Response): Promise<void> {
    try {
      logger.info('API: Get active agents', {
        endpoint: '/api/overrides/active',
        method: 'GET'
      });

      // In development mode, use mock data if WxCC API is not available
      if (config.nodeEnv === 'development' && !config.wxcc.accessToken) {
        logger.info('Using mock data for development', { endpoint: '/api/overrides/active' });
        res.json({
          success: true,
          data: mockActiveAgents,
          count: mockActiveAgents.length,
          timestamp: new Date().toISOString(),
          mock: true
        });
        return;
      }

      const activeAgents = await overrideService.getActiveAgents();

      res.json({
        success: true,
        data: activeAgents,
        count: activeAgents.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // In development mode, fall back to mock data on API error
      if (config.nodeEnv === 'development') {
        logger.warn('API failed, using mock data for development', {
          endpoint: '/api/overrides/active',
          error: errorMessage
        });
        res.json({
          success: true,
          data: mockActiveAgents,
          count: mockActiveAgents.length,
          timestamp: new Date().toISOString(),
          mock: true,
          warning: 'Using mock data - WxCC API not available'
        });
        return;
      }

      logger.error('Failed to get active agents', {
        endpoint: '/api/overrides/active',
        error: errorMessage
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch active agents',
        message: errorMessage
      });
    }
  }

  /**
   * GET /api/health
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'wxcc-overrides-api'
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: errorMessage
      });
    }
  }

  /**
   * Validate update request structure
   */
  private isValidUpdateRequest(data: any): data is UpdateAgentRequest {
    return (
      typeof data === 'object' &&
      typeof data.workingHours === 'boolean' &&
      typeof data.startDateTime === 'string' &&
      typeof data.endDateTime === 'string'
    );
  }
}

export const overrideController = new OverrideController();