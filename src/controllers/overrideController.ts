import { Request, Response } from 'express';
import { overrideService } from '../services/overrideService';
import { UpdateAgentRequest } from '../types';
import { logger } from '../utils/logger';

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

      const containers = await overrideService.getAllContainersWithAgents();
      
      // Convert to frontend-friendly format
      const containerResponses = await Promise.all(
        containers.map(container => 
          overrideService.getContainerForFrontend(container.id)
        )
      );

      res.json({
        success: true,
        data: containerResponses,
        count: containerResponses.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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

      const updatedAgent = await overrideService.updateAgentSchedule(containerId, agentId, updateData);

      res.json({
        success: true,
        data: updatedAgent,
        message: 'Agent schedule updated successfully'
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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

      const activeAgents = await overrideService.getActiveAgents();

      res.json({
        success: true,
        data: activeAgents,
        count: activeAgents.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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