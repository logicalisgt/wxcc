# WxCC Overrides API Backend

Backend API service for WebEx Contact Center (WxCC) Overrides integration, providing comprehensive management of override containers and agent schedules with validation and real-time status tracking.

## Features

- **Container Management**: List and retrieve override containers with detailed agent information
- **Agent Schedule Management**: Update agent schedules with comprehensive validation
- **Schedule Conflict Prevention**: Ensures no overlapping schedules for active agents (workingHours: true)
- **Real-time Status Tracking**: Determine currently active agents across all containers
- **Persistent Agent Mapping**: SQLite-based mapping of WxCC override names to human-friendly agent names
- **Working Hours Toggle**: Enable/disable working hours with schedule conflict validation
- **Automatic Cleanup**: Remove orphaned mappings when overrides are deleted from WxCC
- **Structured Logging**: JSON-formatted logs for all API calls, validations, and errors
- **Error Handling**: Clear error messages for validation failures and API issues
- **Type Safety**: Full TypeScript implementation with comprehensive type definitions

## Architecture

The backend implements a layered architecture:

1. **API Layer** (`src/controllers/`): Express.js controllers handling HTTP requests/responses
2. **Business Logic Layer** (`src/services/`): Core business logic and validation
3. **Database Layer** (`src/services/databaseService.ts`): SQLite-based persistent storage for agent mappings
4. **External API Layer** (`src/services/wxccApiClient.ts`): WxCC API integration client
5. **Middleware Layer** (`src/middleware/`): Request logging, error handling
6. **Configuration Layer** (`src/config/`): Environment-based configuration management
7. **Utilities Layer** (`src/utils/`): Logging, validation helpers

## API Endpoints

### Health Check
- **GET** `/api/health` - Service health check

### Container Management  
- **GET** `/api/overrides/containers` - List all containers with agents and status
- **GET** `/api/overrides/containers/:id` - Get specific container details

### Agent Management
- **PUT** `/api/overrides/containers/:containerId/agents/:agentId` - Update agent schedule

### Active Agents
- **GET** `/api/overrides/active` - Get currently active agents across all containers

### Agent Mapping (New!)
- **GET** `/api/overrides/mappings` - Get all override mappings with WxCC context
- **POST** `/api/overrides/map` - Create or update an agent mapping
- **PATCH** `/api/overrides/working-hours` - Toggle working hours for a mapped override

## Detailed API Documentation

### GET `/api/overrides/mappings`
Returns all override names from WxCC with their mapping status and working hours configuration.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "overrideName": "Day for me",
      "agentName": "John Smith",
      "workingHoursActive": true,
      "isMapped": true,
      "startDateTime": "2024-01-01T08:00:00Z",
      "endDateTime": "2024-01-01T17:00:00Z",
      "containerId": "container456",
      "containerName": "Sales Team Override"
    },
    {
      "overrideName": "Fire Drill",
      "agentName": null,
      "workingHoursActive": false,
      "isMapped": false,
      "startDateTime": "2024-01-01T09:00:00Z",
      "endDateTime": "2024-01-01T18:00:00Z",
      "containerId": "container456",
      "containerName": "Sales Team Override"
    }
  ],
  "count": 2,
  "mappedCount": 1,
  "unmappedCount": 1
}
```

### POST `/api/overrides/map`
Create or update a mapping between a WxCC override name and a human-friendly agent name.

**Request Body:**
```json
{
  "overrideName": "Day for me",
  "agentName": "John Smith"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overrideName": "Day for me",
    "agentName": "John Smith", 
    "workingHoursActive": false,
    "isMapped": true,
    "startDateTime": "2024-01-01T08:00:00Z",
    "endDateTime": "2024-01-01T17:00:00Z",
    "containerId": "container456",
    "containerName": "Sales Team Override"
  },
  "message": "Successfully mapped 'Day for me' to 'John Smith'"
}
```

**Error Cases:**
- `404`: Override name not found in WxCC
- `400`: Invalid request data (missing required fields)

### PATCH `/api/overrides/working-hours`
Toggle working hours for a mapped override with schedule conflict validation.

**Request Body:**
```json
{
  "overrideName": "Day for me",
  "workingHoursActive": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overrideName": "Day for me",
    "agentName": "John Smith",
    "workingHoursActive": true,
    "isMapped": true,
    "startDateTime": "2024-01-01T08:00:00Z",
    "endDateTime": "2024-01-01T17:00:00Z",
    "containerId": "container456",
    "containerName": "Sales Team Override"
  },
  "message": "Working hours activated for 'Day for me'"
}
```

**Error Cases:**
- `404`: Mapping not found for override name
- `409`: Schedule conflict with another active agent
- `400`: Invalid request data

## Business Logic

### WxCC API Multi-Step Workflow

This application strictly follows the WxCC API contract using a documented multi-step workflow:

#### Step 1: List Override Containers
- **Endpoint**: `GET /organization/{orgid}/v2/overrides`
- **Purpose**: Get basic information about all override containers
- **Sample Request**:
```bash
GET https://api.wxcc-eu2.cisco.com/organization/my-org-id/v2/overrides
Authorization: Bearer {access_token}
Content-Type: application/json
```
- **Sample Response**:
```json
{
  "data": [
    {
      "id": "container-123",
      "name": "Sales Team Override",
      "description": "Override container for sales team",
      "createdTime": "2024-01-01T00:00:00Z",
      "lastModifiedTime": "2024-01-01T12:00:00Z"
    }
  ]
}
```

#### Step 2: Get Full Container Details
- **Endpoint**: `GET /organization/{orgid}/overrides/{id}`
- **Purpose**: Fetch complete container including all overrides (agents)
- **Sample Request**:
```bash
GET https://api.wxcc-eu2.cisco.com/organization/my-org-id/overrides/container-123
Authorization: Bearer {access_token}
Content-Type: application/json
```
- **Sample Response**:
```json
{
  "id": "container-123",
  "organizationId": "my-org-id",
  "version": 1,
  "name": "Sales Team Override",
  "description": "Override container for sales team",
  "timezone": "UTC",
  "createdTime": "2024-01-01T00:00:00Z",
  "lastModifiedTime": "2024-01-01T12:00:00Z",
  "overrides": [
    {
      "name": "Day for me",
      "workingHours": true,
      "startDateTime": "2024-01-01T08:00:00Z",
      "endDateTime": "2024-01-01T17:00:00Z"
    },
    {
      "name": "Fire Drill",
      "workingHours": false,
      "startDateTime": "2024-01-01T09:00:00Z",
      "endDateTime": "2024-01-01T18:00:00Z"
    }
  ]
}
```

#### Step 3: Update Override Schedule (Multi-Step Process)
When updating an override schedule, the application:

1. **Fetches the full container** (Step 2 above)
2. **Finds the specific override** by matching `agentId` to `override.name`
3. **Updates only the target override** while preserving all other overrides
4. **Constructs complete container object** with all required fields
5. **Sends the complete container** as PUT request body

- **Endpoint**: `PUT /organization/{orgid}/overrides/{id}`
- **Purpose**: Update specific override within container
- **Sample Request**:
```bash
PUT https://api.wxcc-eu2.cisco.com/organization/my-org-id/overrides/container-123
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "id": "container-123",
  "organizationId": "my-org-id",
  "version": 1,
  "name": "Sales Team Override",
  "description": "Override container for sales team",
  "timezone": "UTC",
  "createdTime": "2024-01-01T00:00:00Z",
  "lastModifiedTime": "2024-01-01T15:30:00Z",
  "overrides": [
    {
      "name": "Day for me",
      "workingHours": true,
      "startDateTime": "2024-01-01T09:00:00Z",
      "endDateTime": "2024-01-01T18:00:00Z"
    },
    {
      "name": "Fire Drill",
      "workingHours": false,
      "startDateTime": "2024-01-01T09:00:00Z",
      "endDateTime": "2024-01-01T18:00:00Z"
    }
  ]
}
```
- **Sample Response**:
```json
{
  "id": "container-123",
  "organizationId": "my-org-id",
  "version": 2,
  "name": "Sales Team Override",
  "description": "Override container for sales team",
  "timezone": "UTC",
  "createdTime": "2024-01-01T00:00:00Z",
  "lastModifiedTime": "2024-01-01T15:30:00Z",
  "overrides": [
    {
      "name": "Day for me",
      "workingHours": true,
      "startDateTime": "2024-01-01T09:00:00Z",
      "endDateTime": "2024-01-01T18:00:00Z"
    },
    {
      "name": "Fire Drill",
      "workingHours": false,
      "startDateTime": "2024-01-01T09:00:00Z",
      "endDateTime": "2024-01-01T18:00:00Z"
    }
  ]
}
```

### Enhanced API Logging

All WxCC API calls include detailed logging for complete traceability:

- **Before API Call**: Operation type, full URL, complete request body
- **After API Call**: Full response status, complete response body, execution time
- **Error Cases**: HTTP status, WxCC error message, error code, request/response details

**Sample Log Entry (Success)**:
```json
{
  "timestamp": "2024-01-01T15:30:00.000Z",
  "level": "info",
  "message": "WxCC API Call Starting",
  "type": "wxcc_api_call_start",
  "method": "PUT",
  "url": "/organization/my-org-id/overrides/container-123",
  "fullUrl": "https://api.wxcc-eu2.cisco.com/organization/my-org-id/overrides/container-123",
  "operation": "update_override_by_id",
  "requestBody": { /* complete container object */ }
}
```

**Sample Log Entry (Error)**:
```json
{
  "timestamp": "2024-01-01T15:30:00.000Z",
  "level": "error",
  "message": "WxCC API Call Failed",
  "type": "wxcc_api_call_error",
  "method": "PUT",
  "url": "/organization/my-org-id/overrides/container-123",
  "status": 400,
  "wxccErrorMessage": "Invalid override data",
  "wxccErrorCode": "VALIDATION_ERROR",
  "requestBody": { /* request that failed */ },
  "responseBody": { /* WxCC error response */ }
}
```

### Override Container Processing
1. Fetches all containers using WxCC List API
2. For each container, fetches detailed info using Get-by-ID API to obtain sub-overrides (agents)
3. Maps WxCC override data to internal Agent format with enhanced metadata

### Agent Schedule Validation
- **Date Validation**: Ensures proper ISO 8601 format and logical date ordering
- **Overlap Detection**: Prevents multiple agents with `workingHours: true` from having overlapping schedules
- **Status Determination**: Automatically determines agent status (ACTIVE, INACTIVE, SCHEDULED, EXPIRED)

### Agent Status Logic
- `INACTIVE`: workingHours = false
- `SCHEDULED`: workingHours = true, current time < startDateTime  
- `ACTIVE`: workingHours = true, current time within [startDateTime, endDateTime]
- `EXPIRED`: workingHours = true, current time > endDateTime

### Agent/Override Mapping

**Critical**: The system correctly uses the WxCC override `name` field for all agent/override mapping operations:
- `agentId` in our internal model maps to `override.name` in WxCC API
- All lookups and updates use the override name, not container name or ID
- Mapping service validates override names against WxCC data using the `name` field

### Persistent Agent Mapping System
The system includes a SQLite-based mapping layer that associates WxCC override names (e.g., "Day for me", "Fire Drill") with human-friendly agent names:

#### Database Schema
```sql
CREATE TABLE wxcc_agent_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  override_name TEXT UNIQUE NOT NULL,
  agent_name TEXT NOT NULL,
  working_hours_active INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Mapping Workflow
1. **Discovery**: Fetch all overrides from WxCC API
2. **Mapping**: Associate override names with human-friendly agent names
3. **Validation**: Enable working hours only after checking for schedule conflicts
4. **Cleanup**: Remove orphaned mappings when overrides are deleted from WxCC

#### Working Hours Validation
- Before enabling working hours, the system validates against existing active agents
- Uses the same schedule conflict detection logic as the original agent management
- Prevents overlapping schedules to ensure consistent agent coverage

## Data Models

### Agent Response Format
```json
{
  "agentId": "agent123",
  "containerId": "container456", 
  "containerName": "Sales Team Override",
  "workingHours": true,
  "startDateTime": "2024-01-01T08:00:00Z",
  "endDateTime": "2024-01-01T17:00:00Z", 
  "status": "active",
  "isCurrentlyActive": true
}
```

### Container Response Format
```json
{
  "id": "container456",
  "name": "Sales Team Override",
  "description": "Override container for sales team",
  "agents": [...],
  "activeAgents": [...],
  "totalAgents": 5,
  "activeCount": 2
}
```

### Override Mapping Response Format (New!)
```json
{
  "overrideName": "Day for me",
  "agentName": "John Smith",
  "workingHoursActive": true,
  "isMapped": true,
  "startDateTime": "2024-01-01T08:00:00Z",
  "endDateTime": "2024-01-01T17:00:00Z",
  "containerId": "container456",
  "containerName": "Sales Team Override"
}
```

### Mapping Request Format
```json
{
  "overrideName": "Fire Drill",
  "agentName": "Jane Smith"
}
```

### Working Hours Toggle Request Format
```json
{
  "overrideName": "Fire Drill",
  "workingHoursActive": true
}
```

## Installation

1. **Clone Repository**
```bash
git clone <repository-url>
cd wxcc
```

2. **Install Dependencies** 
```bash
npm install
```

3. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your WxCC API credentials
```

4. **Build Project**
```bash
npm run build
```

5. **Database Setup**
The SQLite database is automatically created on first run. The database file `wxcc_mappings.db` will be created in the project root directory. No additional setup is required.

## Configuration

Environment variables are automatically loaded from `.env` file at application startup using dotenv. This ensures all configuration values are available during initialization.

Required environment variables:

- `WXCC_API_BASE_URL`: WxCC API base URL (default: https://api.wxcc-eu2.cisco.com)
- `WXCC_ACCESS_TOKEN`: WxCC API access token (required)  
- `WXCC_ORG_ID`: WxCC Organization ID (required) - Used for constructing API endpoints
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (info/debug/error)

Optional configurations:
- `API_RETRY_ATTEMPTS`: Number of retry attempts for failed API calls (default: 3)
- `API_RETRY_DELAY`: Delay between retries in milliseconds (default: 1000)  
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)
- `PRETTY_LOGS`: Enable colorized console output (default: true in development)

### Environment Loading
The application loads environment variables from `.env` file at the very top of the main entry point (`src/index.ts`) before any other imports or configurations. This ensures that `WXCC_ACCESS_TOKEN` and `WXCC_ORG_ID` are always available during configuration validation.

## Usage

### Development
```bash
npm run dev
```

### Production
```bash  
npm start
```

### Testing
```bash
npm test
npm run test:watch
```

### Linting
```bash
npm run lint
npm run lint:fix
```

## Logging

The application uses structured JSON logging with the following categories:

- **API Calls**: All external WxCC API calls with timing and status
- **HTTP Requests**: All incoming HTTP requests with response times
- **Validation Errors**: Schedule conflicts and data validation failures
- **Schedule Conflicts**: Detailed logging when overlapping schedules are detected
- **Application Errors**: Unhandled errors with full stack traces

Example log entry:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "info", 
  "message": "API Call",
  "type": "api_call",
  "method": "GET",
  "url": "/telephony/config/override-containers",
  "duration": 245,
  "status": 200,
  "service": "wxcc-overrides-api"
}
```

## Error Handling

### Validation Errors (400 Bad Request)
- Invalid date formats
- Overlapping schedules for active agents
- Missing required fields

### Not Found Errors (404 Not Found)  
- Container not found
- Agent not found

### Server Errors (500 Internal Server Error)
- WxCC API communication failures
- Internal service errors

All errors return a consistent format:
```json
{
  "success": false,
  "error": "Validation error", 
  "message": "Schedule conflicts with agent agent123"
}
```

## Testing

The test suite includes:

- **Unit Tests**: Business logic validation, schedule conflict detection, agent status determination
- **Integration Tests**: API endpoint functionality
- **Validation Tests**: Error handling and edge cases

Run tests with coverage:
```bash
npm test -- --coverage
```

## Architecture Decisions

1. **TypeScript**: Provides compile-time type safety and better developer experience
2. **Express.js**: Lightweight, flexible web framework suitable for API services
3. **Winston**: Structured logging with JSON format for better observability
4. **Date-fns**: Reliable date manipulation library for schedule validation
5. **Layered Architecture**: Clean separation of concerns for maintainability
6. **Error-first Callbacks**: Consistent error handling throughout the application

## Security Considerations

- **Input Validation**: All API inputs are validated before processing
- **CORS Configuration**: Configurable allowed origins for cross-origin requests
- **Helmet.js**: Security headers for HTTP responses  
- **Access Token Management**: Secure handling of WxCC API credentials
- **Error Sanitization**: Production errors don't expose sensitive information

## Performance Considerations  

- **Retry Logic**: Exponential backoff for failed API calls
- **Connection Pooling**: Efficient HTTP client configuration
- **Memory Management**: Proper cleanup and garbage collection
- **Logging Efficiency**: Structured logging with appropriate levels

## Future Enhancements

- Rate limiting for API endpoints
- Caching layer for frequently accessed data
- WebSocket support for real-time updates
- Metrics and monitoring integration  
- API documentation with OpenAPI/Swagger
- Enhanced audit logging with history tracking
- Bulk operations for mapping management
