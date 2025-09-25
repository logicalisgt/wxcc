/**
 * Mapping Service Tests
 * 
 * Tests for the agent mapping business logic
 */

import { databaseService } from '../services/databaseService';
import { overrideService } from '../services/overrideService';
import { mappingService } from '../services/mappingService';
import { 
  OverrideContainer,
  Agent,
  AgentStatus,
  MappingRequest,
  WorkingHoursToggleRequest
} from '../types';

// Mock the services
jest.mock('../services/databaseService');
jest.mock('../services/overrideService');

const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;
const mockOverrideService = overrideService as jest.Mocked<typeof overrideService>;

describe('MappingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllMappings', () => {
    it('should return all mappings with WxCC context', async () => {
      // Mock WxCC containers data
      const mockContainers: OverrideContainer[] = [
        {
          id: 'container-1',
          name: 'Test Container',
          description: 'Test container',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          agents: [
            {
              agentId: 'Day for me',
              containerId: 'container-1',
              containerName: 'Test Container',
              workingHours: false,
              startDateTime: '2024-01-01T08:00:00Z',
              endDateTime: '2024-01-01T17:00:00Z',
              status: AgentStatus.SCHEDULED
            },
            {
              agentId: 'Fire Drill',
              containerId: 'container-1',
              containerName: 'Test Container',
              workingHours: true,
              startDateTime: '2024-01-01T09:00:00Z',
              endDateTime: '2024-01-01T18:00:00Z',
              status: AgentStatus.ACTIVE
            }
          ]
        }
      ];

      // Mock database mappings
      const mockMappings = [
        {
          id: 1,
          overrideName: 'Day for me',
          agentName: 'John Smith',
          workingHoursActive: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      mockOverrideService.getAllContainersWithAgents.mockResolvedValue(mockContainers);
      mockDatabaseService.getAllMappings.mockReturnValue(mockMappings);
      mockDatabaseService.cleanupOrphanedMappings.mockReturnValue(0);

      const result = await mappingService.getAllMappings();

      expect(result).toHaveLength(2); // Both WxCC agents should be included
      
      // Check mapped agent
      const mappedAgent = result.find(r => r.overrideName === 'Day for me');
      expect(mappedAgent).toBeDefined();
      expect(mappedAgent!.agentName).toBe('John Smith');
      expect(mappedAgent!.isMapped).toBe(true);
      expect(mappedAgent!.containerId).toBe('container-1');

      // Check unmapped agent
      const unmappedAgent = result.find(r => r.overrideName === 'Fire Drill');
      expect(unmappedAgent).toBeDefined();
      expect(unmappedAgent!.agentName).toBeNull();
      expect(unmappedAgent!.isMapped).toBe(false);

      expect(mockDatabaseService.cleanupOrphanedMappings).toHaveBeenCalledWith(['Day for me', 'Fire Drill']);
    });

    it('should handle empty WxCC data', async () => {
      mockOverrideService.getAllContainersWithAgents.mockResolvedValue([]);
      mockDatabaseService.getAllMappings.mockReturnValue([]);

      const result = await mappingService.getAllMappings();

      expect(result).toHaveLength(0);
    });
  });

  describe('createOrUpdateMapping', () => {
    it('should create a new mapping for existing override', async () => {
      const request: MappingRequest = {
        overrideName: 'Test Override',
        agentName: 'Test Agent'
      };

      // Mock WxCC validation
      const mockContainers: OverrideContainer[] = [
        {
          id: 'container-1',
          name: 'Test Container',
          description: 'Test',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          agents: [
            {
              agentId: 'Test Override',
              containerId: 'container-1',
              containerName: 'Test Container',
              workingHours: false,
              startDateTime: '2024-01-01T08:00:00Z',
              endDateTime: '2024-01-01T17:00:00Z',
              status: AgentStatus.SCHEDULED
            }
          ]
        }
      ];

      const mockMapping = {
        id: 1,
        overrideName: 'Test Override',
        agentName: 'Test Agent',
        workingHoursActive: false,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      mockOverrideService.getAllContainersWithAgents.mockResolvedValue(mockContainers);
      mockDatabaseService.upsertMapping.mockReturnValue(mockMapping);

      const result = await mappingService.createOrUpdateMapping(request);

      expect(result.overrideName).toBe('Test Override');
      expect(result.agentName).toBe('Test Agent');
      expect(result.isMapped).toBe(true);
      expect(result.containerId).toBe('container-1');
      expect(mockDatabaseService.upsertMapping).toHaveBeenCalledWith(request);
    });

    it('should throw error for non-existent override', async () => {
      const request: MappingRequest = {
        overrideName: 'Non-existent Override',
        agentName: 'Test Agent'
      };

      mockOverrideService.getAllContainersWithAgents.mockResolvedValue([]);

      await expect(mappingService.createOrUpdateMapping(request))
        .rejects
        .toThrow("Override name 'Non-existent Override' not found in WxCC");
    });
  });

  describe('updateWorkingHours', () => {
    it('should disable working hours without validation', async () => {
      const request: WorkingHoursToggleRequest = {
        overrideName: 'Test Override',
        workingHoursActive: false
      };

      const mockMapping = {
        id: 1,
        overrideName: 'Test Override',
        agentName: 'Test Agent',
        workingHoursActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const mockUpdatedMapping = { ...mockMapping, workingHoursActive: false };

      mockDatabaseService.getMapping.mockReturnValue(mockMapping);
      mockDatabaseService.updateWorkingHours.mockReturnValue(mockUpdatedMapping);
      mockOverrideService.getAllContainersWithAgents.mockResolvedValue([]);

      const result = await mappingService.updateWorkingHours(request);

      expect(result.workingHoursActive).toBe(false);
      // Should not call validation for disabling working hours
      expect(mockOverrideService.getContainerById).not.toHaveBeenCalled();
    });

    it('should throw error for non-existent mapping', async () => {
      const request: WorkingHoursToggleRequest = {
        overrideName: 'Non-existent',
        workingHoursActive: true
      };

      mockDatabaseService.getMapping.mockReturnValue(null);

      await expect(mappingService.updateWorkingHours(request))
        .rejects
        .toThrow('No mapping found for override name: Non-existent');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockOverrideService.getAllContainersWithAgents.mockRejectedValue(new Error('WxCC API Error'));

      await expect(mappingService.getAllMappings())
        .rejects
        .toThrow('WxCC API Error');
    });
  });
});