#!/usr/bin/env ts-node

/**
 * Demo script to showcase the enhanced logging and date formatting features
 * Run with: PRETTY_LOGS=true NODE_ENV=development npx ts-node src/demo.ts
 */

import { prettyLogger } from './utils/prettyLogger';
import { toWxccFormat, convertObjectDatesToWxcc, isWxccFormat } from './utils/dateFormat';
import { databaseService } from './services/databaseService';

async function demonstrateFeatures() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 WxCC Enhanced Logging & Date Formatting Demo');
  console.log('='.repeat(60));

  // 1. Date Formatting Demonstration
  console.log('\n📅 1. DATE FORMATTING DEMONSTRATION');
  console.log('-'.repeat(40));
  
  const testDates = [
    '2024-01-15T09:30:45.123Z',      // ISO with milliseconds
    '2024-01-15T17:30:00Z',          // ISO without milliseconds
    new Date('2024-01-15T14:30:00+05:00') // Date object with timezone
  ];

  testDates.forEach((date, index) => {
    const input = date instanceof Date ? date.toISOString() : date;
    const wxccFormat = toWxccFormat(date);
    console.log(`   Input ${index + 1}: ${input}`);
    console.log(`   WxCC:    ${wxccFormat} (valid: ${isWxccFormat(wxccFormat)})`);
    console.log('');
  });

  // 2. Object Date Conversion
  console.log('\n📦 2. OBJECT DATE CONVERSION');
  console.log('-'.repeat(40));
  
  const updateData = {
    workingHours: true,
    startDateTime: '2024-01-15T09:30:45.123Z',
    endDateTime: '2024-01-15T17:30:00Z',
    description: 'Test schedule update'
  };

  console.log('   Original object:');
  console.log('  ', JSON.stringify(updateData, null, 2));
  
  const converted = convertObjectDatesToWxcc(updateData, ['startDateTime', 'endDateTime']);
  console.log('\n   Converted for WxCC API:');
  console.log('  ', JSON.stringify(converted, null, 2));

  // 3. Pretty Logger Demonstration
  console.log('\n🎨 3. PRETTY LOGGER DEMONSTRATION');
  console.log('-'.repeat(40));

  prettyLogger.info('Starting demo operations', { 
    timestamp: new Date().toISOString(),
    environment: 'demo' 
  });

  prettyLogger.success('Date conversion completed successfully', {
    convertedFields: ['startDateTime', 'endDateTime'],
    format: 'WxCC compliant'
  });

  prettyLogger.warning('This is a sample warning message', {
    level: 'warn',
    context: 'demo'
  });

  // 4. Database Operation Logging
  console.log('\n🗄 4. DATABASE OPERATION LOGGING');
  console.log('-'.repeat(40));

  prettyLogger.dbOperation({
    operation: 'SELECT',
    table: 'wxcc_agent_mappings',
    query: 'SELECT * FROM wxcc_agent_mappings WHERE override_name = ?',
    params: ['demo-override'],
    before: null,
    after: {
      id: 1,
      overrideName: 'demo-override',
      agentName: 'Demo Agent',
      workingHoursActive: true,
      createdAt: '2024-01-15T09:30:00',
      updatedAt: '2024-01-15T09:30:00'
    }
  });

  prettyLogger.dbOperation({
    operation: 'UPDATE',
    table: 'wxcc_agent_mappings',
    query: 'UPDATE wxcc_agent_mappings SET working_hours_active = ? WHERE override_name = ?',
    params: [false, 'demo-override'],
    before: { workingHoursActive: true },
    after: { workingHoursActive: false }
  });

  // 5. API Call Logging
  console.log('\n🌐 5. API CALL LOGGING');
  console.log('-'.repeat(40));

  prettyLogger.apiCall({
    operation: 'update_override',
    method: 'PUT',
    url: '/organization/demo-org/overrides/container-123',
    status: 200,
    duration: 245,
    requestBody: {
      id: 'container-123',
      organizationId: 'demo-org',
      name: 'Demo Container',
      overrides: [{
        name: 'demo-override',
        workingHours: true,
        startDateTime: '2024-01-15T09:30',  // WxCC format
        endDateTime: '2024-01-15T17:30'     // WxCC format
      }]
    },
    responseBody: {
      success: true,
      id: 'container-123',
      lastModifiedTime: '2024-01-15T09:30'
    }
  });

  // 6. Mapping Operations
  console.log('\n🔗 6. MAPPING OPERATION LOGGING');
  console.log('-'.repeat(40));

  prettyLogger.mappingOperation('VALIDATION', 'demo-override', {
    exists: true,
    containerId: 'container-123',
    containerName: 'Demo Container'
  });

  prettyLogger.mappingOperation('UPSERT', 'demo-override', {
    operation: 'create',
    before: null,
    after: {
      overrideName: 'demo-override',
      agentName: 'Demo Agent',
      workingHoursActive: true
    }
  });

  // 7. Schedule Conflict Detection
  console.log('\n⚡ 7. SCHEDULE CONFLICT DETECTION');
  console.log('-'.repeat(40));

  prettyLogger.scheduleConflict('agent-1', 'agent-2', 'container-123', {
    conflictType: 'time_overlap',
    agent1Schedule: {
      start: '2024-01-15T09:00',
      end: '2024-01-15T17:00'
    },
    agent2Schedule: {
      start: '2024-01-15T14:00',
      end: '2024-01-15T22:00'
    },
    overlapDuration: '3 hours',
    resolution: 'manual_review_required'
  });

  // 8. Error Logging
  console.log('\n❌ 8. ERROR LOGGING');
  console.log('-'.repeat(40));

  prettyLogger.error('WxCC API validation failed', {
    operation: 'update_override',
    containerId: 'container-123',
    agentId: 'demo-override',
    error: 'Invalid date format provided',
    originalDateTime: '2024-01-15T09:30:45.123Z',
    expectedFormat: 'yyyy-MM-dd\'T\'HH:mm',
    statusCode: 400
  });

  console.log('\n' + '='.repeat(60));
  console.log('✨ Demo completed! All features showcased.');
  console.log('='.repeat(60));
  console.log('\n💡 Key Benefits:');
  console.log('   • Date formats automatically converted to WxCC requirements');
  console.log('   • Human-readable logs with color coding and context');
  console.log('   • Before/after state tracking for database operations');
  console.log('   • Detailed API request/response logging');
  console.log('   • Clear mapping operation flows with validation steps');
  console.log('   • Enhanced error context for faster debugging\n');
}

// Run the demo
if (require.main === module) {
  demonstrateFeatures().catch(console.error);
}

export { demonstrateFeatures };