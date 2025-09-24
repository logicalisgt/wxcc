# WxCC Overrides API Backend

Backend API service for WebEx Contact Center (WxCC) Overrides integration, providing comprehensive management of override containers and agent schedules with validation and real-time status tracking.

## Features

- **Container Management**: List and retrieve override containers with detailed agent information
- **Agent Schedule Management**: Update agent schedules with comprehensive validation
- **Schedule Conflict Prevention**: Ensures no overlapping schedules for active agents (workingHours: true)
- **Real-time Status Tracking**: Determine currently active agents across all containers
- **Structured Logging**: JSON-formatted logs for all API calls, validations, and errors
- **Error Handling**: Clear error messages for validation failures and API issues
- **Type Safety**: Full TypeScript implementation with comprehensive type definitions

## Architecture

The backend implements a layered architecture:

1. **API Layer** (`src/controllers/`): Express.js controllers handling HTTP requests/responses
2. **Business Logic Layer** (`src/services/`): Core business logic and validation
3. **External API Layer** (`src/services/wxccApiClient.ts`): WxCC API integration client
4. **Middleware Layer** (`src/middleware/`): Request logging, error handling
5. **Configuration Layer** (`src/config/`): Environment-based configuration management
6. **Utilities Layer** (`src/utils/`): Logging, validation helpers

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

## Business Logic

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

## Configuration

Required environment variables:

- `WXCC_API_BASE_URL`: WxCC API base URL (default: https://your-wxcc-instance.cisco.com/)
- `WXCC_ACCESS_TOKEN`: WxCC API access token (required)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (info/debug/error)

Optional configurations:
- `API_RETRY_ATTEMPTS`: Number of retry attempts for failed API calls (default: 3)
- `API_RETRY_DELAY`: Delay between retries in milliseconds (default: 1000)  
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)

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
- Database persistence for audit trails
- Metrics and monitoring integration
- API documentation with OpenAPI/Swagger
