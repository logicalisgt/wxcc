import chalk from 'chalk';
import { format } from 'date-fns';
import { config } from '../config';

/**
 * Pretty logger utility for human-readable, colorized console output
 * Used alongside the existing JSON logger for better development experience
 */

export interface PrettyLogContext {
  operation?: string;
  containerId?: string;
  agentId?: string;
  overrideName?: string;
  [key: string]: any;
}

export interface DbOperationContext {
  operation: string;
  table?: string;
  before?: any;
  after?: any;
  query?: string;
  params?: any[];
}

export interface ApiCallContext {
  operation: string;
  method: string;
  url: string;
  requestBody?: any;
  responseBody?: any;
  duration?: number;
  status?: number;
}

class PrettyLogger {
  private isEnabled: boolean;

  constructor() {
    // Enable pretty logs in development by default, or when explicitly enabled
    this.isEnabled = config.nodeEnv === 'development' || 
                    process.env.PRETTY_LOGS === 'true' ||
                    config.logging.format === 'pretty';
  }

  private timestamp(): string {
    return format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS');
  }

  private formatContext(context: any): string {
    if (!context || Object.keys(context).length === 0) return '';
    
    const formatted = Object.entries(context)
      .map(([key, value]) => {
        if (typeof value === 'object') {
          return `${key}=${JSON.stringify(value, null, 2)}`;
        }
        return `${key}=${value}`;
      })
      .join(', ');
    
    return ` [${formatted}]`;
  }

  info(message: string, context?: PrettyLogContext): void {
    if (!this.isEnabled) return;
    
    console.log(
      chalk.blue('ℹ') + ' ' +
      chalk.gray(`[${this.timestamp()}]`) + ' ' +
      chalk.white(message) +
      chalk.gray(this.formatContext(context))
    );
  }

  success(message: string, context?: PrettyLogContext): void {
    if (!this.isEnabled) return;
    
    console.log(
      chalk.green('✓') + ' ' +
      chalk.gray(`[${this.timestamp()}]`) + ' ' +
      chalk.green(message) +
      chalk.gray(this.formatContext(context))
    );
  }

  warning(message: string, context?: PrettyLogContext): void {
    if (!this.isEnabled) return;
    
    console.log(
      chalk.yellow('⚠') + ' ' +
      chalk.gray(`[${this.timestamp()}]`) + ' ' +
      chalk.yellow(message) +
      chalk.gray(this.formatContext(context))
    );
  }

  error(message: string, context?: PrettyLogContext): void {
    if (!this.isEnabled) return;
    
    console.log(
      chalk.red('✗') + ' ' +
      chalk.gray(`[${this.timestamp()}]`) + ' ' +
      chalk.red(message) +
      chalk.gray(this.formatContext(context))
    );
  }

  /**
   * Log database operations with before/after state
   */
  dbOperation(context: DbOperationContext): void {
    if (!this.isEnabled) return;

    const { operation, table, before, after, query, params } = context;
    
    console.log(
      chalk.cyan('🗄') + ' ' +
      chalk.gray(`[${this.timestamp()}]`) + ' ' +
      chalk.cyan(`DB ${operation}${table ? ` (${table})` : ''}`)
    );
    
    if (before) {
      console.log(
        chalk.gray('   Before: ') + 
        chalk.magenta(JSON.stringify(before, null, 2))
      );
    }
    
    if (after) {
      console.log(
        chalk.gray('   After:  ') + 
        chalk.green(JSON.stringify(after, null, 2))
      );
    }
    
    if (query) {
      console.log(
        chalk.gray('   Query:  ') + 
        chalk.blue(query)
      );
      
      if (params && params.length > 0) {
        console.log(
          chalk.gray('   Params: ') + 
          chalk.yellow(JSON.stringify(params))
        );
      }
    }
  }

  /**
   * Log API calls with request/response details
   */
  apiCall(context: ApiCallContext): void {
    if (!this.isEnabled) return;

    const { operation, method, url, requestBody, responseBody, duration, status } = context;
    
    const statusColor = status && status >= 200 && status < 300 ? chalk.green : chalk.red;
    const methodColor = method === 'GET' ? chalk.blue : method === 'POST' ? chalk.yellow : 
                       method === 'PUT' ? chalk.magenta : method === 'DELETE' ? chalk.red : chalk.white;
    
    console.log(
      chalk.white('🌐') + ' ' +
      chalk.gray(`[${this.timestamp()}]`) + ' ' +
      methodColor(`${method}`) + ' ' +
      chalk.white(operation) + ' ' +
      statusColor(`(${status})`) +
      (duration ? chalk.gray(` ${duration}ms`) : '')
    );
    
    console.log(chalk.gray(`   URL: ${url}`));
    
    if (requestBody) {
      console.log(
        chalk.gray('   Request:  ') + 
        chalk.yellow(JSON.stringify(requestBody, null, 2))
      );
    }
    
    if (responseBody) {
      console.log(
        chalk.gray('   Response: ') + 
        chalk.green(JSON.stringify(responseBody, null, 2))
      );
    }
  }

  /**
   * Log mapping operations with detailed context
   */
  mappingOperation(operation: string, overrideName: string, details: any): void {
    if (!this.isEnabled) return;
    
    console.log(
      chalk.magenta('🔗') + ' ' +
      chalk.gray(`[${this.timestamp()}]`) + ' ' +
      chalk.magenta(`Mapping ${operation}`) + ' ' +
      chalk.white(`"${overrideName}"`)
    );
    
    if (details) {
      console.log(
        chalk.gray('   Details: ') + 
        chalk.white(JSON.stringify(details, null, 2))
      );
    }
  }

  /**
   * Log schedule conflicts with detailed information
   */
  scheduleConflict(agentId: string, conflictingAgentId: string, containerId: string, details?: any): void {
    if (!this.isEnabled) return;
    
    console.log(
      chalk.red('⚡') + ' ' +
      chalk.gray(`[${this.timestamp()}]`) + ' ' +
      chalk.red('Schedule Conflict Detected')
    );
    
    console.log(chalk.gray(`   Agent: ${agentId}`));
    console.log(chalk.gray(`   Conflicts with: ${conflictingAgentId}`));
    console.log(chalk.gray(`   Container: ${containerId}`));
    
    if (details) {
      console.log(
        chalk.gray('   Details: ') + 
        chalk.red(JSON.stringify(details, null, 2))
      );
    }
  }

  /**
   * Log working hours toggle operations with before/after state and validation details
   */
  workingHoursToggle(overrideName: string, beforeState: boolean, afterState: boolean, context?: any, validationErrors?: string[]): void {
    if (!this.isEnabled) return;
    
    const toggleIcon = afterState ? '🟢' : '🔴';
    const toggleText = afterState ? 'ENABLED' : 'DISABLED';
    const statusColor = afterState ? chalk.green : chalk.red;
    
    console.log(
      toggleIcon + ' ' +
      chalk.gray(`[${this.timestamp()}]`) + ' ' +
      statusColor(`Working Hours ${toggleText}`) + ' ' +
      chalk.white(`"${overrideName}"`)
    );
    
    // Show before/after state
    console.log(chalk.gray(`   Before: ${beforeState ? 'Active' : 'Inactive'}`));
    console.log(chalk.gray(`   After:  ${afterState ? 'Active' : 'Inactive'}`));
    
    // Show operation context
    if (context) {
      console.log(
        chalk.gray('   Context: ') + 
        chalk.cyan(JSON.stringify(context, null, 2))
      );
    }
    
    // Show validation errors if any
    if (validationErrors && validationErrors.length > 0) {
      console.log(chalk.red('   Validation Errors:'));
      validationErrors.forEach(error => {
        console.log(chalk.red(`     ❌ ${error}`));
      });
    }
  }

  /**
   * Enable/disable pretty logging
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Check if pretty logging is enabled
   */
  get enabled(): boolean {
    return this.isEnabled;
  }
}

// Export singleton instance
export const prettyLogger = new PrettyLogger();