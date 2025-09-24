# WxCC Overrides API - Endpoint Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
All WxCC API calls are authenticated using the access token configured in environment variables. No additional authentication is required for the API endpoints themselves.

## Endpoints

### 1. Health Check
**GET** `/health`

Returns the health status of the API service.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "service": "wxcc-overrides-api"
}
```

---

### 2. List All Override Containers
**GET** `/overrides/containers`

Retrieves all override containers with their agents and current status.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "container123",
      "name": "Sales Team Override",
      "description": "Override container for sales team agents",
      "agents": [
        {
          "agentId": "agent456",
          "containerId": "container123",
          "containerName": "Sales Team Override",
          "workingHours": true,
          "startDateTime": "2024-01-01T08:00:00Z",
          "endDateTime": "2024-01-01T17:00:00Z",
          "status": "active",
          "isCurrentlyActive": true
        }
      ],
      "activeAgents": [
        {
          "agentId": "agent456",
          "containerId": "container123",
          "containerName": "Sales Team Override",
          "workingHours": true,
          "startDateTime": "2024-01-01T08:00:00Z",
          "endDateTime": "2024-01-01T17:00:00Z",
          "status": "active",
          "isCurrentlyActive": true
        }
      ],
      "totalAgents": 1,
      "activeCount": 1
    }
  ],
  "count": 1
}
```

---

### 3. Get Container by ID
**GET** `/overrides/containers/{containerId}`

Retrieves a specific override container with its agents.

**Path Parameters:**
- `containerId` (string): The unique identifier of the container

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "container123",
    "name": "Sales Team Override",
    "description": "Override container for sales team agents",
    "agents": [
      {
        "agentId": "agent456",
        "containerId": "container123",
        "containerName": "Sales Team Override",
        "workingHours": true,
        "startDateTime": "2024-01-01T08:00:00Z",
        "endDateTime": "2024-01-01T17:00:00Z",
        "status": "active",
        "isCurrentlyActive": true
      }
    ],
    "activeAgents": [
      {
        "agentId": "agent456",
        "containerId": "container123",
        "containerName": "Sales Team Override",
        "workingHours": true,
        "startDateTime": "2024-01-01T08:00:00Z",
        "endDateTime": "2024-01-01T17:00:00Z",
        "status": "active",
        "isCurrentlyActive": true
      }
    ],
    "totalAgents": 1,
    "activeCount": 1
  }
}
```

**Error Responses:**
- `404 Not Found`: Container not found
- `500 Internal Server Error`: Server error

---

### 4. Update Agent Schedule
**PUT** `/overrides/containers/{containerId}/agents/{agentId}`

Updates an agent's schedule with validation to prevent overlapping schedules for active agents.

**Path Parameters:**
- `containerId` (string): The unique identifier of the container
- `agentId` (string): The unique identifier of the agent

**Request Body:**
```json
{
  "workingHours": true,
  "startDateTime": "2024-01-01T09:00:00Z",
  "endDateTime": "2024-01-01T18:00:00Z"
}
```

**Request Body Schema:**
- `workingHours` (boolean, required): Whether the agent is actively working during the schedule
- `startDateTime` (string, required): ISO 8601 formatted start date and time
- `endDateTime` (string, required): ISO 8601 formatted end date and time

**Response:**
```json
{
  "success": true,
  "data": {
    "agentId": "agent456",
    "containerId": "container123",
    "containerName": "Sales Team Override",
    "workingHours": true,
    "startDateTime": "2024-01-01T09:00:00Z",
    "endDateTime": "2024-01-01T18:00:00Z",
    "status": "active"
  },
  "message": "Agent schedule updated successfully"
}
```

**Validation Rules:**
1. `startDateTime` must be before `endDateTime`
2. `endDateTime` cannot be in the past
3. If `workingHours` is `true`, the schedule cannot overlap with other agents who have `workingHours: true` in the same container

**Error Responses:**
- `400 Bad Request`: Validation errors (invalid dates, overlapping schedules, missing fields)
- `404 Not Found`: Container or agent not found
- `500 Internal Server Error`: Server error

**Example Validation Error:**
```json
{
  "success": false,
  "error": "Validation error", 
  "message": "Validation failed: Schedule conflicts with agent agent789"
}
```

---

### 5. Get Currently Active Agents
**GET** `/overrides/active`

Returns all currently active agents across all containers.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "agentId": "agent456",
      "containerId": "container123",
      "containerName": "Sales Team Override",
      "workingHours": true,
      "startDateTime": "2024-01-01T08:00:00Z",
      "endDateTime": "2024-01-01T17:00:00Z",
      "status": "active",
      "isCurrentlyActive": true
    },
    {
      "agentId": "agent789", 
      "containerId": "container456",
      "containerName": "Support Team Override",
      "workingHours": true,
      "startDateTime": "2024-01-01T09:00:00Z",
      "endDateTime": "2024-01-01T18:00:00Z",
      "status": "active",
      "isCurrentlyActive": true
    }
  ],
  "count": 2,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

---

## Agent Status Values

- **`active`**: Agent has `workingHours: true` and current time is within the schedule window
- **`inactive`**: Agent has `workingHours: false`
- **`scheduled`**: Agent has `workingHours: true` but schedule starts in the future
- **`expired`**: Agent has `workingHours: true` but schedule has ended

## Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation error",
  "message": "workingHours, startDateTime, and endDateTime are required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Container not found", 
  "message": "Failed to fetch container container123: Container not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Failed to fetch containers"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **Window**: 15 minutes (900,000ms)
- **Max Requests**: 100 requests per window per IP

When rate limit is exceeded, the API returns `429 Too Many Requests`.

## CORS

The API supports Cross-Origin Resource Sharing (CORS) with configurable allowed origins. Default allowed origins are:
- `http://localhost:3000`
- `http://localhost:3001`

## Content Type

All request and response bodies use `application/json` content type.