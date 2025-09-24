import { OverrideService } from '../services/overrideService';
import { Agent, AgentStatus, UpdateAgentRequest } from '../types';

// Mock the WxCC API client
jest.mock('../services/wxccApiClient', () => ({
  wxccApiClient: {
    listOverrideContainers: jest.fn(),
    getOverrideContainerById: jest.fn(),
    updateOverride: jest.fn()
  }
}));

describe('OverrideService', () => {
  let overrideService: OverrideService;

  beforeEach(() => {
    overrideService = new OverrideService();
    jest.clearAllMocks();
  });

  describe('Schedule Validation', () => {
    test('should detect overlapping schedules for workingHours: true agents', async () => {
      const existingAgents: Agent[] = [
        {
          agentId: 'agent1',
          containerId: 'container1',
          containerName: 'Test Container',
          workingHours: true,
          startDateTime: '2024-01-01T08:00:00Z',
          endDateTime: '2024-01-01T16:00:00Z',
          status: AgentStatus.ACTIVE
        }
      ];

      const updateData: UpdateAgentRequest = {
        workingHours: true,
        startDateTime: '2024-01-01T12:00:00Z', // Overlaps with agent1
        endDateTime: '2024-01-01T20:00:00Z'
      };

      // Use reflection to access private method for testing
      const findScheduleConflict = (overrideService as any).findScheduleConflict.bind(overrideService);
      const conflict = findScheduleConflict(existingAgents, 'agent2', updateData);

      expect(conflict).toBe(existingAgents[0]);
    });

    test('should allow non-overlapping schedules', async () => {
      const existingAgents: Agent[] = [
        {
          agentId: 'agent1',
          containerId: 'container1',
          containerName: 'Test Container',
          workingHours: true,
          startDateTime: '2024-01-01T08:00:00Z',
          endDateTime: '2024-01-01T12:00:00Z',
          status: AgentStatus.ACTIVE
        }
      ];

      const updateData: UpdateAgentRequest = {
        workingHours: true,
        startDateTime: '2024-01-01T13:00:00Z', // No overlap
        endDateTime: '2024-01-01T17:00:00Z'
      };

      const findScheduleConflict = (overrideService as any).findScheduleConflict.bind(overrideService);
      const conflict = findScheduleConflict(existingAgents, 'agent2', updateData);

      expect(conflict).toBe(null);
    });

    test('should allow overlapping schedules when workingHours is false', async () => {
      const existingAgents: Agent[] = [
        {
          agentId: 'agent1',
          containerId: 'container1',
          containerName: 'Test Container',
          workingHours: false, // Not working, so no conflict
          startDateTime: '2024-01-01T08:00:00Z',
          endDateTime: '2024-01-01T16:00:00Z',
          status: AgentStatus.INACTIVE
        }
      ];

      const updateData: UpdateAgentRequest = {
        workingHours: true,
        startDateTime: '2024-01-01T12:00:00Z',
        endDateTime: '2024-01-01T20:00:00Z'
      };

      const findScheduleConflict = (overrideService as any).findScheduleConflict.bind(overrideService);
      const conflict = findScheduleConflict(existingAgents, 'agent2', updateData);

      expect(conflict).toBe(null);
    });
  });

  describe('Agent Status Determination', () => {
    test('should determine INACTIVE status for workingHours: false', () => {
      const determineAgentStatus = (overrideService as any).determineAgentStatus.bind(overrideService);
      const status = determineAgentStatus(
        '2024-01-01T08:00:00Z',
        '2024-01-01T16:00:00Z',
        false
      );

      expect(status).toBe(AgentStatus.INACTIVE);
    });

    test('should determine SCHEDULED status for future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const determineAgentStatus = (overrideService as any).determineAgentStatus.bind(overrideService);
      const status = determineAgentStatus(
        futureDate.toISOString(),
        new Date(futureDate.getTime() + 8 * 60 * 60 * 1000).toISOString(), // +8 hours
        true
      );

      expect(status).toBe(AgentStatus.SCHEDULED);
    });

    test('should determine EXPIRED status for past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const determineAgentStatus = (overrideService as any).determineAgentStatus.bind(overrideService);
      const status = determineAgentStatus(
        new Date(pastDate.getTime() - 8 * 60 * 60 * 1000).toISOString(), // -8 hours from past date
        pastDate.toISOString(),
        true
      );

      expect(status).toBe(AgentStatus.EXPIRED);
    });
  });

  describe('Agent Activity Check', () => {
    test('should identify currently active agents', () => {
      const now = new Date('2024-01-01T12:00:00Z');
      
      const agent: Agent = {
        agentId: 'agent1',
        containerId: 'container1',
        containerName: 'Test Container',
        workingHours: true,
        startDateTime: '2024-01-01T08:00:00Z',
        endDateTime: '2024-01-01T16:00:00Z',
        status: AgentStatus.ACTIVE
      };

      const isAgentCurrentlyActive = (overrideService as any).isAgentCurrentlyActive.bind(overrideService);
      const isActive = isAgentCurrentlyActive(agent, now);

      expect(isActive).toBe(true);
    });

    test('should identify inactive agents outside time window', () => {
      const now = new Date('2024-01-01T18:00:00Z'); // After end time
      
      const agent: Agent = {
        agentId: 'agent1',
        containerId: 'container1',
        containerName: 'Test Container',
        workingHours: true,
        startDateTime: '2024-01-01T08:00:00Z',
        endDateTime: '2024-01-01T16:00:00Z',
        status: AgentStatus.EXPIRED
      };

      const isAgentCurrentlyActive = (overrideService as any).isAgentCurrentlyActive.bind(overrideService);
      const isActive = isAgentCurrentlyActive(agent, now);

      expect(isActive).toBe(false);
    });
  });
});