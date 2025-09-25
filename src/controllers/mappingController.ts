import { Request, Response } from 'express';
import { mappingService } from '../services/mappingService';
import { MappingRequest, WorkingHoursToggleRequest } from '../types';
import { logger } from '../utils/logger';

export class MappingController {

  /**
   * GET /api/overrides/mappings
   * Fetch all override mappings with WxCC context
   */
  async getAllMappings(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Getting all override mappings', { 
        operation: 'get_all_mappings',
        method: req.method,
        url: req.originalUrl 
      });

      const mappings = await mappingService.getAllMappings();

      res.json({
        success: true,
        data: mappings,
        count: mappings.length,
        mappedCount: mappings.filter(m => m.isMapped).length,
        unmappedCount: mappings.filter(m => !m.isMapped).length
      });

      logger.info('Successfully returned all mappings', { 
        totalCount: mappings.length,
        mappedCount: mappings.filter(m => m.isMapped).length
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get all mappings', { 
        error: errorMessage,
        method: req.method,
        url: req.originalUrl 
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch override mappings'
      });
    }
  }

  /**
   * POST /api/overrides/map
   * Create or update an agent mapping
   */
  async createMapping(req: Request, res: Response): Promise<void> {
    try {
      const { overrideName, agentName }: MappingRequest = req.body;

      // Validate required fields
      if (!overrideName || !agentName) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'overrideName and agentName are required'
        });
        return;
      }

      // Trim whitespace
      const cleanRequest: MappingRequest = {
        overrideName: overrideName.trim(),
        agentName: agentName.trim()
      };

      if (!cleanRequest.overrideName || !cleanRequest.agentName) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'overrideName and agentName cannot be empty'
        });
        return;
      }

      logger.info('Creating agent mapping', { 
        operation: 'create_mapping',
        overrideName: cleanRequest.overrideName,
        agentName: cleanRequest.agentName,
        method: req.method,
        url: req.originalUrl 
      });

      const mapping = await mappingService.createOrUpdateMapping(cleanRequest);

      res.json({
        success: true,
        data: mapping,
        message: `Successfully mapped '${cleanRequest.overrideName}' to '${cleanRequest.agentName}'`
      });

      logger.info('Successfully created mapping', { 
        overrideName: cleanRequest.overrideName,
        agentName: cleanRequest.agentName
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create mapping', { 
        error: errorMessage,
        overrideName: req.body?.overrideName,
        method: req.method,
        url: req.originalUrl 
      });

      // Check if it's a validation error (override not found)
      if (errorMessage.includes('not found in WxCC')) {
        res.status(404).json({
          success: false,
          error: 'Override not found',
          message: errorMessage
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create agent mapping'
      });
    }
  }

  /**
   * PATCH /api/overrides/working-hours
   * Toggle working hours for a mapped override
   */
  async updateWorkingHours(req: Request, res: Response): Promise<void> {
    try {
      const { overrideName, workingHoursActive }: WorkingHoursToggleRequest = req.body;

      // Validate required fields
      if (!overrideName || typeof workingHoursActive !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'overrideName (string) and workingHoursActive (boolean) are required'
        });
        return;
      }

      const cleanRequest: WorkingHoursToggleRequest = {
        overrideName: overrideName.trim(),
        workingHoursActive
      };

      if (!cleanRequest.overrideName) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'overrideName cannot be empty'
        });
        return;
      }

      logger.info('Updating working hours status', { 
        operation: 'update_working_hours',
        overrideName: cleanRequest.overrideName,
        workingHoursActive: cleanRequest.workingHoursActive,
        method: req.method,
        url: req.originalUrl 
      });

      const mapping = await mappingService.updateWorkingHours(cleanRequest);

      res.json({
        success: true,
        data: mapping,
        message: `Working hours ${cleanRequest.workingHoursActive ? 'activated' : 'deactivated'} for '${cleanRequest.overrideName}'`
      });

      logger.info('Successfully updated working hours', { 
        overrideName: cleanRequest.overrideName,
        workingHoursActive: cleanRequest.workingHoursActive
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update working hours', { 
        error: errorMessage,
        overrideName: req.body?.overrideName,
        method: req.method,
        url: req.originalUrl 
      });

      // Check for specific error types
      if (errorMessage.includes('No mapping found')) {
        res.status(404).json({
          success: false,
          error: 'Mapping not found',
          message: errorMessage
        });
        return;
      }

      if (errorMessage.includes('Validation failed')) {
        res.status(409).json({
          success: false,
          error: 'Schedule conflict',
          message: errorMessage
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update working hours'
      });
    }
  }
}

// Export singleton instance
export const mappingController = new MappingController();