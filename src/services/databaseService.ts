import sqlite3 from 'sqlite3';
import path from 'path';
import { AgentMapping, MappingRequest } from '../types';
import { logger } from '../utils/logger';
import { prettyLogger } from '../utils/prettyLogger';

// Promisify sqlite3 operations for async/await support
class AsyncDatabase {
  private db: sqlite3.Database;

  constructor(dbPath: string) {
    this.db = new sqlite3.Database(dbPath);
  }

  static create(dbPath: string): Promise<AsyncDatabase> {
    return new Promise<AsyncDatabase>((resolve, reject) => {
      const asyncDb = new AsyncDatabase('');
      asyncDb.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(asyncDb);
        }
      });
    });
  }

  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(this: sqlite3.RunResult, err: Error | null) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get<T>(sql, params, (err: Error | null, row: T) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all<T>(sql, params, (err: Error | null, rows: T[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err: Error | null) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export class DatabaseService {
  private db!: AsyncDatabase;
  private initPromise: Promise<void>;

  constructor(dbPath?: string) {
    // Use a database file in the project root if not specified
    const databasePath = dbPath || path.join(process.cwd(), 'wxcc_mappings.db');
    
    // Initialize the database asynchronously
    this.initPromise = this.initializeDatabase(databasePath);
    
    logger.info('Database service initialized', { databasePath });
  }

  private async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  private async initializeDatabase(databasePath: string): Promise<void> {
    try {
      this.db = await AsyncDatabase.create(databasePath);
      
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

      await this.db.exec(createTableSQL);
      await this.db.exec(createIndexSQL);
      await this.db.exec(createTriggerSQL);
      
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
  async getMapping(overrideName: string): Promise<AgentMapping | null> {
    await this.ensureInitialized();
    try {
      const sql = `
        SELECT id, override_name as overrideName, agent_name as agentName, 
               working_hours_active as workingHoursActive, 
               created_at as createdAt, updated_at as updatedAt
        FROM wxcc_agent_mappings 
        WHERE override_name = ?
      `;
      
      prettyLogger.dbOperation({
        operation: 'SELECT',
        table: 'wxcc_agent_mappings',
        query: sql,
        params: [overrideName]
      });
      
      const result = await this.db.get<any>(sql, [overrideName]);
      
      if (!result) {
        prettyLogger.info('No mapping found', { overrideName });
        return null;
      }

      // Convert SQLite integer to boolean
      const mapping = {
        ...result,
        workingHoursActive: Boolean(result.workingHoursActive)
      } as AgentMapping;
      
      prettyLogger.dbOperation({
        operation: 'SELECT',
        table: 'wxcc_agent_mappings',
        after: mapping
      });
      
      return mapping;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get mapping', { overrideName, error: errorMessage });
      prettyLogger.error('Database read failed', { 
        operation: 'getMapping',
        overrideName, 
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Get all mappings
   */
  async getAllMappings(): Promise<AgentMapping[]> {
    await this.ensureInitialized();
    try {
      const sql = `
        SELECT id, override_name as overrideName, agent_name as agentName, 
               working_hours_active as workingHoursActive,
               created_at as createdAt, updated_at as updatedAt
        FROM wxcc_agent_mappings 
        ORDER BY override_name
      `;
      
      prettyLogger.dbOperation({
        operation: 'SELECT ALL',
        table: 'wxcc_agent_mappings',
        query: sql
      });
      
      const results = await this.db.all<any>(sql);
      
      // Convert SQLite integers to booleans
      const mappings = results.map(result => ({
        ...result,
        workingHoursActive: Boolean(result.workingHoursActive)
      })) as AgentMapping[];
      
      prettyLogger.dbOperation({
        operation: 'SELECT ALL',
        table: 'wxcc_agent_mappings',
        after: { count: mappings.length, mappings }
      });
      
      return mappings;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get all mappings', { error: errorMessage });
      prettyLogger.error('Database read all failed', { 
        operation: 'getAllMappings',
        error: errorMessage 
      });
      throw error;
    }
  }

  /**
   * Create or update a mapping
   */
  async upsertMapping(request: MappingRequest): Promise<AgentMapping> {
    await this.ensureInitialized();
    try {
      // Get current mapping for before state
      const beforeMapping = await this.getMapping(request.overrideName);
      
      const sql = `
        INSERT INTO wxcc_agent_mappings (override_name, agent_name, working_hours_active)
        VALUES (?, ?, 0)
        ON CONFLICT(override_name) 
        DO UPDATE SET 
          agent_name = excluded.agent_name,
          updated_at = CURRENT_TIMESTAMP
      `;

      prettyLogger.dbOperation({
        operation: 'UPSERT',
        table: 'wxcc_agent_mappings',
        before: beforeMapping,
        query: sql,
        params: [request.overrideName, request.agentName]
      });

      await this.db.run(sql, [request.overrideName, request.agentName]);

      // Return the updated/created mapping
      const mapping = await this.getMapping(request.overrideName);
      if (!mapping) {
        throw new Error('Failed to create/update mapping');
      }

      logger.info('Mapping upserted successfully', { 
        overrideName: request.overrideName,
        agentName: request.agentName 
      });

      prettyLogger.dbOperation({
        operation: 'UPSERT',
        table: 'wxcc_agent_mappings',
        before: beforeMapping,
        after: mapping
      });

      prettyLogger.success('Mapping operation completed', {
        overrideName: request.overrideName,
        agentName: request.agentName,
        wasUpdate: beforeMapping !== null
      });

      return mapping;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to upsert mapping', { 
        overrideName: request.overrideName, 
        error: errorMessage 
      });
      
      prettyLogger.error('Database upsert failed', {
        operation: 'upsertMapping',
        overrideName: request.overrideName,
        agentName: request.agentName,
        error: errorMessage
      });
      
      throw error;
    }
  }

  /**
   * Update working hours status for a mapping
   */
  async updateWorkingHours(overrideName: string, workingHoursActive: boolean): Promise<AgentMapping | null> {
    await this.ensureInitialized();
    try {
      // Get current mapping for before state
      const beforeMapping = await this.getMapping(overrideName);
      
      const sql = `
        UPDATE wxcc_agent_mappings 
        SET working_hours_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE override_name = ?
      `;

      prettyLogger.dbOperation({
        operation: 'UPDATE',
        table: 'wxcc_agent_mappings',
        before: beforeMapping,
        query: sql,
        params: [workingHoursActive ? 1 : 0, overrideName]
      });

      const result = await this.db.run(sql, [workingHoursActive ? 1 : 0, overrideName]);
      
      if (result.changes === 0) {
        logger.warn('No mapping found to update working hours', { overrideName });
        prettyLogger.warning('No mapping found for working hours update', { 
          overrideName,
          workingHoursActive 
        });
        return null;
      }

      const updatedMapping = await this.getMapping(overrideName);
      
      logger.info('Working hours updated successfully', { 
        overrideName, 
        workingHoursActive 
      });

      prettyLogger.dbOperation({
        operation: 'UPDATE',
        table: 'wxcc_agent_mappings',
        before: beforeMapping,
        after: updatedMapping
      });

      prettyLogger.success('Working hours updated', {
        overrideName,
        before: beforeMapping?.workingHoursActive,
        after: workingHoursActive
      });

      return updatedMapping;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update working hours', { 
        overrideName, 
        workingHoursActive, 
        error: errorMessage 
      });
      
      prettyLogger.error('Working hours update failed', {
        operation: 'updateWorkingHours',
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
  async cleanupOrphanedMappings(activeOverrideNames: string[]): Promise<number> {
    await this.ensureInitialized();
    try {
      if (activeOverrideNames.length === 0) {
        logger.warn('No active override names provided for cleanup');
        return 0;
      }

      const placeholders = activeOverrideNames.map(() => '?').join(',');
      const sql = `
        DELETE FROM wxcc_agent_mappings 
        WHERE override_name NOT IN (${placeholders})
      `;

      const result = await this.db.run(sql, activeOverrideNames);
      
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
  async getActiveWorkingHoursMappings(): Promise<AgentMapping[]> {
    await this.ensureInitialized();
    try {
      const sql = `
        SELECT id, override_name as overrideName, agent_name as agentName, 
               working_hours_active as workingHoursActive,
               created_at as createdAt, updated_at as updatedAt
        FROM wxcc_agent_mappings 
        WHERE working_hours_active = 1
        ORDER BY override_name
      `;
      
      const results = await this.db.all<any>(sql);
      
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
  async close(): Promise<void> {
    await this.ensureInitialized();
    try {
      await this.db.close();
      logger.info('Database connection closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to close database', { error: errorMessage });
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();