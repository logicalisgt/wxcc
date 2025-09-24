// Core types for WxCC Override API integration

export interface OverrideContainer {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  agents: Agent[];
}

export interface Agent {
  agentId: string; // override.name from WxCC API
  containerId: string;
  containerName: string;
  workingHours: boolean;
  startDateTime: string; // ISO 8601 format
  endDateTime: string;   // ISO 8601 format
  status: AgentStatus;
}

export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SCHEDULED = 'scheduled',
  EXPIRED = 'expired'
}

// WxCC API response types
export interface WxccOverrideContainer {
  id: string;
  name: string;
  description?: string;
  createdTime: string;
  lastModifiedTime: string;
  overrides?: WxccOverride[];
}

export interface WxccOverride {
  name: string; // This becomes our agentId
  workingHours: boolean;
  startDateTime: string;
  endDateTime: string;
}

// API Response types for frontend
export interface ContainerResponse {
  id: string;
  name: string;
  description?: string;
  agents: AgentResponse[];
  activeAgents: AgentResponse[];
  totalAgents: number;
  activeCount: number;
}

export interface AgentResponse {
  agentId: string;
  containerId: string;
  containerName: string;
  workingHours: boolean;
  startDateTime: string;
  endDateTime: string;
  status: AgentStatus;
  isCurrentlyActive: boolean;
}

// Validation types
export interface ScheduleValidationError {
  field: string;
  message: string;
  agentId?: string;
  conflictingAgentId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ScheduleValidationError[];
}

// Update request types
export interface UpdateAgentRequest {
  workingHours: boolean;
  startDateTime: string;
  endDateTime: string;
}

// API configuration
export interface WxccApiConfig {
  baseUrl: string;
  accessToken: string;
  organizationId: string;
  timeout: number;
}