// Mock data for development and demo purposes
import { ContainerResponse, AgentResponse, AgentStatus } from '../types';

export const mockContainers: ContainerResponse[] = [
  {
    id: 'container-1',
    name: 'Sales Team Override',
    description: 'Override container for sales team agents during peak hours',
    agents: [
      {
        agentId: 'john.doe',
        containerId: 'container-1',
        containerName: 'Sales Team Override',
        workingHours: true,
        startDateTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        endDateTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
        status: AgentStatus.ACTIVE,
        isCurrentlyActive: true
      },
      {
        agentId: 'jane.smith',
        containerId: 'container-1',
        containerName: 'Sales Team Override',
        workingHours: true,
        startDateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        endDateTime: new Date(Date.now() + 10800000).toISOString(), // 3 hours from now
        status: AgentStatus.SCHEDULED,
        isCurrentlyActive: false
      },
      {
        agentId: 'mike.johnson',
        containerId: 'container-1',
        containerName: 'Sales Team Override',
        workingHours: false,
        startDateTime: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        endDateTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        status: AgentStatus.EXPIRED,
        isCurrentlyActive: false
      },
      {
        agentId: 'sarah.williams',
        containerId: 'container-1',
        containerName: 'Sales Team Override',
        workingHours: false,
        startDateTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        endDateTime: new Date(Date.now() + 90000000).toISOString(), // Tomorrow + 1 hour
        status: AgentStatus.INACTIVE,
        isCurrentlyActive: false
      }
    ],
    activeAgents: [],
    totalAgents: 4,
    activeCount: 1
  },
  {
    id: 'container-2',
    name: 'Support Team Override',
    description: 'Emergency support override container for critical incidents',
    agents: [
      {
        agentId: 'alex.brown',
        containerId: 'container-2',
        containerName: 'Support Team Override',
        workingHours: true,
        startDateTime: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
        endDateTime: new Date(Date.now() + 5400000).toISOString(), // 1.5 hours from now
        status: AgentStatus.ACTIVE,
        isCurrentlyActive: true
      },
      {
        agentId: 'lisa.davis',
        containerId: 'container-2',
        containerName: 'Support Team Override',
        workingHours: true,
        startDateTime: new Date(Date.now() - 900000).toISOString(), // 15 min ago
        endDateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        status: AgentStatus.ACTIVE,
        isCurrentlyActive: true
      },
      {
        agentId: 'david.wilson',
        containerId: 'container-2',
        containerName: 'Support Team Override',
        workingHours: true,
        startDateTime: new Date(Date.now() + 1800000).toISOString(), // 30 min from now
        endDateTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
        status: AgentStatus.SCHEDULED,
        isCurrentlyActive: false
      }
    ],
    activeAgents: [],
    totalAgents: 3,
    activeCount: 2
  },
  {
    id: 'container-3',
    name: 'Customer Success Team',
    description: 'Premium customer success team override',
    agents: [
      {
        agentId: 'emma.garcia',
        containerId: 'container-3',
        containerName: 'Customer Success Team',
        workingHours: false,
        startDateTime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        endDateTime: new Date(Date.now() + 14400000).toISOString(), // 4 hours from now
        status: AgentStatus.INACTIVE,
        isCurrentlyActive: false
      },
      {
        agentId: 'robert.martinez',
        containerId: 'container-3',
        containerName: 'Customer Success Team',
        workingHours: true,
        startDateTime: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
        endDateTime: new Date(Date.now() + 18000000).toISOString(), // 5 hours from now
        status: AgentStatus.SCHEDULED,
        isCurrentlyActive: false
      }
    ],
    activeAgents: [],
    totalAgents: 2,
    activeCount: 0
  }
];

// Update active agents arrays
mockContainers.forEach(container => {
  container.activeAgents = container.agents.filter(agent => agent.isCurrentlyActive);
  container.activeCount = container.activeAgents.length;
});

export const mockActiveAgents: AgentResponse[] = [
  ...mockContainers.flatMap(container => container.activeAgents)
];