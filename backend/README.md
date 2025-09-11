# Faktions-Live API Backend

This is the backend server for the Faktions-Live API, featuring a sophisticated multi-agent swarm system for meeting analysis, task management, and workflow automation.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- OpenAI API key
- Composio API key
- Linear API key (for Linear integration)
- Notion API key (for Notion integration)
- ClickUp API key (for ClickUp integration)
- Slack API key (for Slack integration)

### Environment Setup
Create a `.env` file in the backend directory:

```bash
# Required API Keys
OPENAI_API_KEY=your_openai_api_key_here
COMPOSIO_API_KEY=your_composio_api_key_here
COMPOSIO_ENTITY_ID=your_composio_entity_id

# Optional API Keys (for specific integrations)
LINEAR_API_KEY=your_linear_api_key_here
NOTION_API_KEY=your_notion_api_key_here
CLICKUP_API_KEY=your_clickup_api_key_here
SLACK_API_KEY=your_slack_api_key_here

# Server Configuration
PORT=3001
```

### Installation & Running

```bash
# Install dependencies
npm install

# Start the server
npm start

# Development mode with auto-reload
npm run dev

# Test swarm functionality
npm run test:swarm
```

The server will start on `http://localhost:3001` (or the port specified in your `.env`).

## 🐳 Docker

### 1) Create `.env`
Create `backend/.env` with the variables your server expects:

```bash
PORT=3001
OPENAI_API_KEY=your_openai_key
COMPOSIO_API_KEY=your_composio_key
COMPOSIO_ENTITY_ID=default_user
```

### 2) Build and run

```bash
cd backend
docker compose up -d --build
```

The container exposes port `3001` by default (overridable via `PORT`).

### 3) Verify health and logs

```bash
curl http://localhost:3001/health
# On Windows PowerShell
Get-ChildItem .\logs
Get-Content .\logs\backend-$(Get-Date -Format yyyy-MM-dd).log -Tail 50 -Wait
```

Notes:
- Logs are persisted via `./logs:/app/logs` bind mount (see `docker-compose.yml`).
- Build context excludes `logs` and `node_modules` via `.dockerignore`; dependencies install in-image using `npm ci`.
- Healthcheck is configured to hit `GET /health` inside the container.

## 🏗️ Architecture Overview

The backend consists of two main components:

### Core Server (`server.js`)
- Main Express server with CORS and middleware configuration
- File upload handling (10MB limit)
- React Agent Manager for dynamic agent creation
- A2A (Agent-to-Agent) server integration
- Health monitoring and graceful shutdown

### Swarm System (`/swarm/`)
The swarm system is the heart of the backend, managing multiple AI agents that work together to process meeting transcripts and execute tasks.

## 📁 Swarm Folder Structure

### Core Swarm Files

#### `index.js`
- Main export file for all swarm components
- Exports: `SwarmManager`, `MultiSwarmManager`, `AgentFactory`, `MeetingSummarizer`

#### `SwarmManager.js`
- Manages individual swarms of agents
- Handles agent coordination within a single swarm
- Processes transcript workflows with multiple agents

#### `MultiSwarmManager.js`
- Orchestrates multiple swarms simultaneously
- Manages swarm lifecycle (create, destroy, monitor)
- Handles inter-swarm communication
- Provides health monitoring and status reporting

#### `AgentFactory.js`
- Creates and configures different types of agents
- Manages agent capabilities and tool assignments
- Handles agent initialization and configuration
- Supports dynamic agent creation based on requirements

#### `MeetingSummarizer.js`
- Processes meeting transcripts into structured summaries
- Generates action items and key takeaways
- Formats transcripts for agent consumption
- **Intelligent multi-platform analysis agent** that:
  - First checks existing Linear issues before making decisions
  - Updates existing tickets with status changes, assignee changes, and comments
  - Only creates new tickets for truly new/unrelated topics
  - Sends informational updates to Slack instead of creating tickets
  - Detects status updates from meeting discussions ("this is done", "we're working on this")
  - Provides matching confidence scores for existing ticket updates

### Agent Types (`/swarm/agents/`)

#### `linearAgent.js`
- Manages Linear project management tasks
- Creates, updates, and manages Linear issues
- Handles issue assignments, status updates, and comments
- Integrates with Linear API for project management

#### `notionAgent.js`
- Manages Notion pages and databases
- Creates and updates Notion content
- Handles page modifications and database operations
- Integrates with Notion API for knowledge management

#### `clickupAgent.js`
- Manages ClickUp tasks and projects
- Creates and updates ClickUp items
- Handles task assignments and status updates
- Integrates with ClickUp API for task management

#### `slackAgent.js`
- Manages Slack communications
- Sends messages and notifications
- Handles channel management and direct messages
- Integrates with Slack API for team communication

### Tools (`/swarm/tools/`)

#### `composioTools.js`
- Provides integration tools for external services
- Includes Linear, Notion, ClickUp, and Slack tool integrations
- Handles API authentication and request formatting
- Manages tool execution and response handling

#### `interSwarmTools.js`
- Enables communication between different swarms
- Provides tools for swarm coordination
- Handles inter-agent messaging and task delegation
- Manages shared resources and state

## 🔌 API Endpoints

**Note**: The following endpoints are available based on the current `server.js` and `/swarm/` folder implementation:

### Health & Status
- `GET /health` - Server health check
- `GET /api/swarm/health` - Swarm system health
- `GET /api/multi-swarm/health` - Multi-swarm system health

### Agent Management
- `POST /api/agents` - Create a new React agent
- `GET /api/agents` - List all agents
- `POST /api/agents/register` - Register an existing agent
- `DELETE /api/agents/:agentId` - Destroy an agent
- `POST /api/agents/:agentId/delegate` - Delegate a task to an agent
- `POST /api/agents/:id/toggle-discoverable` - Toggle agent discoverability

### Meeting Processing
- `POST /api/meeting/transcript` - Process meeting transcript
- `POST /api/linear/process-transcript` - Process transcript with Linear agent
- `POST /api/swarm/process-transcript-with-summary` - Process transcript with swarm summary

### Swarm Operations
- `GET /api/swarm/agents` - List all swarm agents
- `GET /api/swarm/agents/:agentType` - Get agents by type
- `POST /api/swarm/agents/:agentType/process` - Process with specific agent type
- `POST /api/swarm/agents/:agentType/process-transcript` - Process transcript with agent type
- `POST /api/swarm/agents/:agentType/bulk-create` - Bulk create agents

### Multi-Swarm Operations
- `GET /api/multi-swarm/swarms` - List all swarms
- `GET /api/multi-swarm/agents` - List all agents across swarms
- `GET /api/multi-swarm/agents/capability/:capability` - Find agents by capability
- `POST /api/multi-swarm/swarms` - Create a new swarm
- `POST /api/multi-swarm/swarms/:swarmId/process` - Process with specific swarm
- `POST /api/multi-swarm/route` - Route task to appropriate swarm
- `POST /api/multi-swarm/communicate` - Inter-swarm communication
- `POST /api/multi-swarm/process-transcript-workflow` - Complete transcript workflow
- `GET /api/multi-swarm/communications` - Get communication history
- `DELETE /api/multi-swarm/swarms/:swarmId` - Destroy a swarm

### Log Management
- `GET /api/logs` - List all available log files
- `GET /api/logs/:filename` - Get content of specific log file
- `POST /api/logs/clean` - Clean old log files (keep last 30 days)

### Linear Integration
- `GET /api/linear/issues` - List Linear issues
- `GET /api/linear/teams` - List Linear teams
- `POST /api/linear/issues` - Create Linear issues

## 🎯 Key Workflows

### Meeting Transcript Processing
1. **Upload Transcript**: Send transcript to `/api/multi-swarm/process-transcript-workflow`
2. **Summary Generation**: MeetingSummarizer creates structured summary
3. **Intelligent Action Analysis**: Analysis agent:
   - First checks existing Linear issues using LINEAR_GET_LINEAR_ISSUES
   - Updates existing tickets with status changes, assignee changes, and comments
   - Only creates new tickets for truly new/unrelated topics
   - Sends informational updates to Slack instead of creating tickets
   - Detects status updates from meeting discussions
4. **Task Creation**: Appropriate agents create/update tasks in respective systems
5. **Communication**: Slack agent sends notifications and updates

### Multi-Swarm Coordination
1. **Swarm Creation**: Create specialized swarms for different tasks
2. **Task Routing**: Route tasks to appropriate swarms based on capabilities
3. **Inter-Swarm Communication**: Swarms communicate and coordinate
4. **Resource Sharing**: Share tools and data between swarms
5. **Health Monitoring**: Monitor swarm performance and health

**Note**: These workflows are implemented using the available `server.js` and `/swarm/` folder components.

## 🔧 Configuration

### Agent Configuration
- **Model**: gpt-5-mini-2025-08-07 (configurable via environment)
- **Temperature**: 1 (low randomness for consistent results)
- **Memory**: Persistent memory with MemorySaver
- **Tools**: Dynamic tool loading based on agent type

### Swarm Configuration
- **Max Agents per Swarm**: Configurable limit
- **Communication Protocols**: Inter-swarm messaging
- **Health Checks**: Regular health monitoring
- **Resource Management**: Port allocation and cleanup

## 📋 Available Files

**Note**: Only the following files are currently pushed to the repository:
- `server.js` - Main server file
- `/swarm/` folder - Complete swarm system implementation
- `/utils/logger.js` - Advanced logging system
- `package.json` - Dependencies and scripts
- `.env` - Environment configuration (create this file)
- `/logs/` folder - Daily log files (created automatically)

Other components like test files, documentation, and additional utilities are not included in the current repository.

## 🚨 Troubleshooting

### Common Issues

#### "OPENAI_API_KEY is required"
- Ensure your `.env` file has the correct API key
- Check that the key is valid and has sufficient credits

#### "COMPOSIO_API_KEY is required"
- Verify your Composio API key in the `.env` file
- Ensure the key has access to required integrations

#### Port conflicts
- The system uses ports 4000-4999 for dynamic agents
- Check for port conflicts and adjust the range if needed

#### Memory issues
- Large transcripts may cause memory issues
- Consider chunking very long transcripts
- Monitor server memory usage

### Debug Mode
Enable debug logging by setting environment variables:
```bash
DEBUG=swarm:*
LOG_LEVEL=debug
```

## 📊 Monitoring

### Health Checks
- `/health` - Basic server health
- `/api/swarm/health` - Swarm system status
- `/api/multi-swarm/health` - Multi-swarm system status

### Logs
- All operations are logged with timestamps
- Agent creation, destruction, and task execution are tracked
- Error logs include stack traces and context
- **Daily log files** saved to `backend/logs/` folder
- **Non-truncated output** with full JSON data
- **API request/response logging** with full details
- **Automatic log rotation** (30-day retention)

### Log File Structure
- **Daily files**: `backend-YYYY-MM-DD.log`
- **Full timestamps**: ISO format for precise timing
- **Structured data**: JSON objects preserved in full
- **Separator lines**: 80-character dashes between entries
- **Log levels**: INFO, ERROR, WARN, DEBUG, SYSTEM, API_REQUEST, API_RESPONSE, AGENT, SWARM, MEETING

### Metrics
- Agent count and status
- Swarm performance metrics
- Task completion rates
- Error rates and types

## 🔒 Security

### API Key Management
- Store API keys in environment variables
- Never commit API keys to version control
- Use different keys for development and production

### Access Control
- CORS is enabled for cross-origin requests
- File uploads are limited to 10MB
- Input validation is performed on all endpoints

## 📞 Support

While the main developer is on vacation, this README should contain all the information needed to:
- Run and maintain the backend
- Understand the system architecture
- Troubleshoot common issues
- Monitor system health
- Deploy updates

For urgent issues, check the logs and health endpoints first. The system is designed to be self-healing and should handle most common scenarios automatically.

## 🔄 Updates

The system automatically:
- Manages agent lifecycles
- Handles API rate limits
- Retries failed operations
- Cleans up unused resources
- Monitors system health

Regular maintenance tasks are automated, so manual intervention should rarely be required.
