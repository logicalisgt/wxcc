import Database from 'better-sqlite3';
import path from 'path';
import { AgentMapping, MappingRequest } from '../types';
import { logger } from '../utils/logger';

export class DatabaseService {
  private db: Database.Database;

  constructor(dbPath?: string) {
    // Use a database file in the project root if not specified
    const databasePath = dbPath || path.join(process.cwd(), 'wxcc_mappings.db');
    
    this.db = new Database(databasePath);
    this.initializeDatabase();
    
    logger.info('Database service initialized', { databasePath });
  }

  private initializeDatabase(): void {
    // Create the mappings table if it doesn't exist
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS wxcc_agent_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        override_name TEXT UNIQUE NOT NULL,
        agent_name TEXT NOT NULL,
        working_hours_active INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create index for faster lookups
    const createIndexSQL = `
      CREATE INDEX IF NOT EXISTS idx_override_name 
      ON wxcc_agent_mappings(override_name)
    `;

    // Create trigger to update updated_at timestamp
    const createTriggerSQL = `
      CREATE TRIGGER IF NOT EXISTS update_timestamp
      AFTER UPDATE ON wxcc_agent_mappings
      BEGIN
        UPDATE wxcc_agent_mappings 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
      END
    `;

    try {
      this.db.exec(createTableSQL);
      this.db.exec(createIndexSQL);
      this.db.exec(createTriggerSQL);
      
      logger.info('Database schema initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize database schema', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get mapping for a specific override name
   */
  getMapping(overrideName: string): AgentMapping | null {
    try {
      const query = this.db.prepare(`
        SELECT id, override_name as overrideName, agent_name as agentName, 
               working_hours_active as workingHoursActive, 
               created_at as createdAt, updated_at as updatedAt
        FROM wxcc_agent_mappings 
        WHERE override_name = ?
      `);
      
      const result = query.get(overrideName) as any;
      if (!result) return null;

      // Convert SQLite integer to boolean
      return {
        ...result,
        workingHoursActive: Boolean(result.workingHoursActive)
      } as AgentMapping;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get mapping', { overrideName, error: errorMessage });
      throw error;
    }
  }

  /**
   * Get all mappings
   */
  getAllMappings(): AgentMapping[] {
    try {
      const query = this.db.prepare(`
        SELECT id, override_name as overrideName, agent_name as agentName, 
               working_hours_active as workingHoursActive,
               created_at as createdAt, updated_at as updatedAt
        FROM wxcc_agent_mappings 
        ORDER BY override_name
      `);
      
      const results = query.all() as any[];
      
      // Convert SQLite integers to booleans
      return results.map(result => ({
        ...result,
        workingHoursActive: Boolean(result.workingHoursActive)
      })) as AgentMapping[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get all mappings', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Create or update a mapping
   */
  upsertMapping(request: MappingRequest): AgentMapping {
    try {
      const upsertQuery = this.db.prepare(`
        INSERT INTO wxcc_agent_mappings (override_name, agent_name, working_hours_active)
        VALUES (?, ?, 0)
        ON CONFLICT(override_name) 
        DO UPDATE SET 
          agent_name = excluded.agent_name,
          updated_at = CURRENT_TIMESTAMP
      `);

      upsertQuery.run(request.overrideName, request.agentName);

      // Return the updated/created mapping
      const mapping = this.getMapping(request.overrideName);
      if (!mapping) {
        throw new Error('Failed to create/update mapping');
      }

      logger.info('Mapping upserted successfully', { 
        overrideName: request.overrideName,
        agentName: request.agentName 
      });

      return mapping;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to upsert mapping', { 
        overrideName: request.overrideName, 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Update working hours status for a mapping
   */
  updateWorkingHours(overrideName: string, workingHoursActive: boolean): AgentMapping | null {
    try {
      const updateQuery = this.db.prepare(`
        UPDATE wxcc_agent_mappings 
        SET working_hours_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE override_name = ?
      `);

      const result = updateQuery.run(workingHoursActive ? 1 : 0, overrideName);
      
      if (result.changes === 0) {
        logger.warn('No mapping found to update working hours', { overrideName });
        return null;
      }

      const updatedMapping = this.getMapping(overrideName);
      
      logger.info('Working hours updated successfully', { 
        overrideName, 
        workingHoursActive 
      });

      return updatedMapping;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update working hours', { 
        overrideName, 
        workingHoursActive, 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Remove mappings that are no longer present in WxCC
   */
  cleanupOrphanedMappings(activeOverrideNames: string[]): number {
    try {
      if (activeOverrideNames.length === 0) {
        logger.warn('No active override names provided for cleanup');
        return 0;
      }

      const placeholders = activeOverrideNames.map(() => '?').join(',');
      const deleteQuery = this.db.prepare(`
        DELETE FROM wxcc_agent_mappings 
        WHERE override_name NOT IN (${placeholders})
      `);

      const result = deleteQuery.run(...activeOverrideNames);
      
      if (result.changes > 0) {
        logger.info('Cleaned up orphaned mappings', { 
          deletedCount: result.changes,
          activeCount: activeOverrideNames.length 
        });
      }

      return result.changes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to cleanup orphaned mappings', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Get mappings with active working hours for conflict detection
   */
  getActiveWorkingHoursMappings(): AgentMapping[] {
    try {
      const query = this.db.prepare(`
        SELECT id, override_name as overrideName, agent_name as agentName, 
               working_hours_active as workingHoursActive,
               created_at as createdAt, updated_at as updatedAt
        FROM wxcc_agent_mappings 
        WHERE working_hours_active = 1
        ORDER BY override_name
      `);
      
      const results = query.all() as any[];
      
      // Convert SQLite integers to booleans
      return results.map(result => ({
        ...result,
        workingHoursActive: Boolean(result.workingHoursActive)
      })) as AgentMapping[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get active working hours mappings', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    try {
      this.db.close();
      logger.info('Database connection closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to close database', { error: errorMessage });
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();