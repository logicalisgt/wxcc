/**
 * Database Service Tests
 * 
 * Tests for the SQLite-based agent mapping functionality
 */

import { DatabaseService } from '../services/databaseService';
import { MappingRequest } from '../types';
import path from 'path';
import fs from 'fs';

describe('DatabaseService', () => {
  let dbService: DatabaseService;
  const testDbPath = path.join(__dirname, 'test_mapping.db');

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Create new instance for each test
    dbService = new DatabaseService(testDbPath);
  });

  afterEach(() => {
    // Clean up database connection and file
    dbService.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('Database Initialization', () => {
    it('should create database table on initialization', () => {
      expect(dbService).toBeDefined();
      
      // Test that we can perform basic operations
      const mappings = dbService.getAllMappings();
      expect(Array.isArray(mappings)).toBe(true);
      expect(mappings.length).toBe(0);
    });
  });

  describe('Mapping Operations', () => {
    it('should create a new mapping', () => {
      const request: MappingRequest = {
        overrideName: 'Day for me',
        agentName: 'John Smith'
      };

      const mapping = dbService.upsertMapping(request);
      
      expect(mapping.overrideName).toBe(request.overrideName);
      expect(mapping.agentName).toBe(request.agentName);
      expect(mapping.workingHoursActive).toBe(false);
      expect(mapping.id).toBeGreaterThan(0);
    });

    it('should update existing mapping', () => {
      const request: MappingRequest = {
        overrideName: 'Fire Drill',
        agentName: 'Jane Doe'
      };

      // Create initial mapping
      const initialMapping = dbService.upsertMapping(request);
      
      // Update with new agent name
      const updateRequest: MappingRequest = {
        overrideName: 'Fire Drill',
        agentName: 'Jane Smith'
      };
      
      const updatedMapping = dbService.upsertMapping(updateRequest);
      
      expect(updatedMapping.id).toBe(initialMapping.id);
      expect(updatedMapping.agentName).toBe('Jane Smith');
      expect(updatedMapping.overrideName).toBe('Fire Drill');
    });

    it('should retrieve mapping by override name', () => {
      const request: MappingRequest = {
        overrideName: 'Emergency Response',
        agentName: 'Bob Wilson'
      };

      dbService.upsertMapping(request);
      
      const retrieved = dbService.getMapping('Emergency Response');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.agentName).toBe('Bob Wilson');
      
      const notFound = dbService.getMapping('Non-existent');
      expect(notFound).toBeNull();
    });

    it('should retrieve all mappings', () => {
      const mappings = [
        { overrideName: 'Agent 1', agentName: 'Alice' },
        { overrideName: 'Agent 2', agentName: 'Bob' },
        { overrideName: 'Agent 3', agentName: 'Charlie' }
      ];

      mappings.forEach(mapping => dbService.upsertMapping(mapping));
      
      const allMappings = dbService.getAllMappings();
      expect(allMappings.length).toBe(3);
      expect(allMappings.map(m => m.agentName).sort()).toEqual(['Alice', 'Bob', 'Charlie']);
    });
  });

  describe('Working Hours Operations', () => {
    beforeEach(() => {
      // Create a mapping for working hours tests
      dbService.upsertMapping({
        overrideName: 'Test Agent',
        agentName: 'Test User'
      });
    });

    it('should update working hours status', () => {
      const updated = dbService.updateWorkingHours('Test Agent', true);
      
      expect(updated).not.toBeNull();
      expect(updated!.workingHoursActive).toBe(true);
      
      const disabled = dbService.updateWorkingHours('Test Agent', false);
      expect(disabled!.workingHoursActive).toBe(false);
    });

    it('should return null for non-existent mapping when updating working hours', () => {
      const result = dbService.updateWorkingHours('Non-existent', true);
      expect(result).toBeNull();
    });

    it('should get mappings with active working hours', () => {
      // Create additional mappings
      dbService.upsertMapping({ overrideName: 'Agent 1', agentName: 'User 1' });
      dbService.upsertMapping({ overrideName: 'Agent 2', agentName: 'User 2' });
      
      // Activate working hours for some agents
      dbService.updateWorkingHours('Test Agent', true);
      dbService.updateWorkingHours('Agent 1', true);
      // Leave Agent 2 with working hours disabled
      
      const activeMappings = dbService.getActiveWorkingHoursMappings();
      expect(activeMappings.length).toBe(2);
      expect(activeMappings.map(m => m.overrideName).sort()).toEqual(['Agent 1', 'Test Agent']);
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(() => {
      // Create test mappings
      const testMappings = [
        { overrideName: 'Active Agent', agentName: 'Active User' },
        { overrideName: 'Inactive Agent', agentName: 'Inactive User' },
        { overrideName: 'Obsolete Agent', agentName: 'Obsolete User' }
      ];
      
      testMappings.forEach(mapping => dbService.upsertMapping(mapping));
    });

    it('should cleanup orphaned mappings', () => {
      const activeOverrides = ['Active Agent', 'Inactive Agent'];
      
      const deletedCount = dbService.cleanupOrphanedMappings(activeOverrides);
      
      expect(deletedCount).toBe(1); // Should delete 'Obsolete Agent'
      
      const remainingMappings = dbService.getAllMappings();
      expect(remainingMappings.length).toBe(2);
      expect(remainingMappings.map(m => m.overrideName).sort()).toEqual(['Active Agent', 'Inactive Agent']);
    });

    it('should handle empty active overrides list', () => {
      const deletedCount = dbService.cleanupOrphanedMappings([]);
      expect(deletedCount).toBe(0); // Should not delete anything when no active overrides provided
      
      const remainingMappings = dbService.getAllMappings();
      expect(remainingMappings.length).toBe(3); // All mappings should remain
    });

    it('should cleanup all mappings when no active overrides match', () => {
      const activeOverrides = ['New Agent 1', 'New Agent 2'];
      
      const deletedCount = dbService.cleanupOrphanedMappings(activeOverrides);
      
      expect(deletedCount).toBe(3); // Should delete all existing mappings
      
      const remainingMappings = dbService.getAllMappings();
      expect(remainingMappings.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle duplicate override names with upsert', () => {
      const request: MappingRequest = {
        overrideName: 'Duplicate Test',
        agentName: 'First Name'
      };

      const first = dbService.upsertMapping(request);
      
      // Try to create again with different agent name
      const updateRequest: MappingRequest = {
        overrideName: 'Duplicate Test',
        agentName: 'Second Name'
      };
      
      const second = dbService.upsertMapping(updateRequest);
      
      expect(first.id).toBe(second.id); // Same record
      expect(second.agentName).toBe('Second Name'); // Updated value
      
      const allMappings = dbService.getAllMappings();
      expect(allMappings.length).toBe(1); // Only one record
    });
  });
});