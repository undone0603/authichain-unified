# Unified Architect Agent System

## Overview

The Unified Architect Agent system provides a framework for coordinating multiple specialized AI agents to handle different aspects of AuthiChain development and operations. This system enables sophisticated task routing, parallel execution, and intelligent capability-based delegation.

## Architecture

```
┌─────────────────────────────────────────┐
│   Agent Orchestrator                    │
│   (Central Coordinator)                 │
└────────────┬────────────────────────────┘
             │
    ┌────────┼────────┬────────────┐
    │        │        │            │
    ▼        ▼        ▼            ▼
┌────────┐┌────────┐┌────────┐┌────────┐
│Execute ││Technic ││Operati ││Data    │
│iveAget││al Agent││ons Agt ││Agent   │
└────────┘└────────┘└────────┘└────────┘
    │        │        │            │
    └────────┼────────┼────────────┘
             │        │
         ┌───┴────────┴───┐
         │ Agent Registry  │
         │ (Discovery)     │
         └────────────────┘
```

## Components

### 1. Base Agent Interface (`server/agents/base/agent.interface.ts`)

Defines the contract all agents must implement:

```typescript
export interface BaseAgent {
  name: string;
  capabilities: AgentCapability[];
  version: string;
  tools: AgentTool[];

  execute(action: string, params: any, context?: AgentContext): Promise<AgentExecutionResult>;
  getTools(): AgentTool[];
  canHandle(capability: AgentCapability): boolean;
  healthCheck(): Promise<boolean>;
}
```

### 2. Agent Registry (`server/agents/base/agent.registry.ts`)

Central registry for agent discovery and routing:

- **Initialize**: Registers all available agents on startup
- **Discovery**: Find agents by capability or name
- **Dynamic Registration**: Add new agents at runtime
- **Health Checks**: Monitor agent health
- **Listing**: View all available agents and their capabilities

### 3. Agent Orchestrator (`server/agents/base/agent.orchestrator.ts`)

Coordinates task execution across agents:

- **Task Routing**: Routes tasks to appropriate agents by capability
- **Execution Modes**: Sequential, parallel, with dependencies
- **Timeouts**: Enforce execution timeouts
- **Retries**: Configurable retry logic
- **History**: Track all executions
- **Statistics**: Performance metrics per agent

### 4. Implemented Agents

#### Executive Agent (`server/agents/executive.unified.ts`)

Handles business operations, marketing, and strategic content:

**Capabilities**: `executive`, `sales`

**Tools**:
- `draft_sales_email` - Generate personalized sales emails
- `draft_partnership_email` - Create partnership proposals
- `generate_linkedin_post` - LinkedIn content generation
- `generate_blog_post` - Blog content with keywords
- `generate_email_campaign` - Multi-variant campaign creation
- `daily_briefing` - Executive daily briefing

**Example**:
```typescript
const result = await agent.execute('draft_sales_email', {
  prospect: {
    name: 'Jane Doe',
    company: 'MegaCorp',
    industry: 'Manufacturing',
    city: 'Detroit'
  }
});
```

#### Technical Agent (`server/agents/technical.unified.ts`)

Handles code, infrastructure, and operations:

**Capabilities**: `technical`, `operations`

**Tools**:
- `analyze_codebase` - Analyze project structure and patterns
- `check_type_safety` - TypeScript type validation
- `propose_implementation` - Feature implementation planning
- `audit_performance` - Performance bottleneck analysis
- `check_security` - Security review
- `generate_migration` - Database migration generation

**Example**:
```typescript
const result = await agent.execute('check_type_safety', {
  files: ['server/agents/executive.unified.ts']
});
```

## Usage Patterns

### 1. Direct Agent Execution

```typescript
import { ExecutiveAgentImpl } from './agents/executive.unified.js';

const agent = new ExecutiveAgentImpl();
const result = await agent.execute('draft_sales_email', {
  prospect: { name: 'John', company: 'Corp' }
});
```

### 2. Registry-Based Routing

```typescript
import { AgentRegistry } from './agents/base/agent.registry.js';

await AgentRegistry.initialize();

const agent = AgentRegistry.getAgent('ExecutiveAgent');
const result = await agent?.execute('draft_sales_email', params);
```

### 3. Orchestrator-Based Execution

```typescript
import { AgentOrchestrator, AgentTask } from './agents/base/agent.orchestrator.js';

const orchestrator = AgentOrchestrator.getInstance();
await orchestrator.initialize();

const task: AgentTask = {
  id: 'task-001',
  capability: 'executive',
  action: 'draft_sales_email',
  params: { prospect: { /* ... */ } }
};

const result = await orchestrator.executeTask(task);
```

### 4. Parallel Execution

```typescript
const tasks: AgentTask[] = [
  {
    id: 'email',
    capability: 'executive',
    action: 'draft_sales_email',
    params: { /* ... */ }
  },
  {
    id: 'analysis',
    capability: 'technical',
    action: 'analyze_codebase',
    params: { paths: ['server/'] }
  }
];

const results = await orchestrator.executeParallel(tasks);
```

### 5. Sequential Execution with Dependencies

```typescript
const tasks: AgentTask[] = [
  { id: 'analysis', capability: 'technical', action: 'analyze_codebase', params: {} },
  { id: 'proposal', capability: 'technical', action: 'propose_implementation', params: {} }
];

const dependencies = {
  'proposal': ['analysis']
};

const results = await orchestrator.executeSequential(tasks, dependencies);
```

## Adding New Agents

### Step 1: Extend AbstractAgent

```typescript
import { AbstractAgent, AgentContext, AgentCapability } from './base/agent.interface.js';

export class MyAgentImpl extends AbstractAgent {
  name = 'MyAgent';
  capabilities: AgentCapability[] = ['custom_capability'];
  version = '1.0.0';

  constructor() {
    super();
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      {
        name: 'my_tool',
        description: 'What it does',
        execute: (params) => this.myToolImpl(params)
      }
    ];
  }

  async execute(action: string, params: any, context?: AgentContext) {
    // Implementation
  }

  async myToolImpl(params: any): Promise<string> {
    // Tool implementation
  }
}
```

### Step 2: Register in AgentRegistry

```typescript
// In agent.registry.ts
const agentConstructors: AgentConstructor[] = [
  ExecutiveAgentImpl,
  TechnicalAgentImpl,
  MyAgentImpl  // Add your agent
];
```

## Monitoring & Observability

### Execution History

```typescript
const history = orchestrator.getExecutionHistory('ExecutiveAgent', 10);
```

### Statistics

```typescript
const stats = orchestrator.getStatistics();
console.log({
  totalExecutions: stats.totalExecutions,
  successRate: stats.successCount / stats.totalExecutions,
  averageDuration: stats.averageDuration,
  byAgent: stats.byAgent
});
```

### Health Checks

```typescript
const health = await orchestrator.healthCheckAll();
console.log(health);
// { ExecutiveAgent: true, TechnicalAgent: true, ... }
```

## Configuration

### Agent Context

Pass execution context to agents:

```typescript
const context: AgentContext = {
  userId: 'user-123',
  sessionId: 'sess-456',
  missionId: 789,
  taskId: 101,
  metadata: { source: 'webhook' }
};

const result = await agent.execute(action, params, context);
```

### Execution Options

```typescript
const task: AgentTask = {
  id: 'task-001',
  capability: 'technical',
  action: 'check_security',
  params: { scope: 'code' },
  retries: 3,           // Retry up to 3 times
  timeout: 30000,       // 30 second timeout
  context: { userId: 'user-123' }
};
```

## Best Practices

### 1. Use Appropriate Capabilities

Match task types to agent capabilities:
- `executive` → Marketing, sales, strategy content
- `technical` → Code analysis, architecture, infrastructure
- `operations` → Monitoring, maintenance, compliance
- `data` → Analytics, reporting, insights

### 2. Provide Clear Context

Always include relevant context for audit trails:

```typescript
const context = {
  userId: currentUser.id,
  missionId: mission.id,
  metadata: { source: 'api', priority: 'high' }
};
```

### 3. Handle Failures Gracefully

```typescript
const result = await orchestrator.executeTask(task);

if (!result.success) {
  console.error(`Task failed: ${result.result.error}`);
  // Implement fallback logic
}
```

### 4. Use Timeouts for Long-Running Tasks

```typescript
const task: AgentTask = {
  // ...
  timeout: 60000  // 1 minute for performance audits
};
```

### 5. Monitor Performance

```typescript
const stats = orchestrator.getStatistics();

if (stats.byAgent.TechnicalAgent?.avgDuration > 30000) {
  console.warn('TechnicalAgent is slow');
}
```

## Testing

Run the unified agent tests:

```bash
pnpm test -- server/agents/unified.test.ts
```

## Roadmap

### Phase 1 ✅ (Current)
- Base agent interface
- Agent registry
- Orchestrator
- ExecutiveAgent implementation
- TechnicalAgent implementation

### Phase 2 (Next)
- OperationsAgent (monitoring, alerting)
- DataAgent (analytics, reporting)
- Plugin architecture for hot-reload
- Enhanced retry/circuit-breaker logic

### Phase 3 (Future)
- Multi-tenant agent routing
- Federated execution (agents spawning sub-agents)
- Agent-to-agent communication
- Advanced scheduling (cron, event-driven)
- Cost tracking per agent execution

## Troubleshooting

### Agent Not Found

```typescript
const agents = AgentRegistry.getAgentsByCapability('missing_capability');
if (agents.length === 0) {
  console.log('No agent available for this capability');
}
```

### Task Timeout

```typescript
const result = await orchestrator.executeTask({
  // ...
  timeout: 120000  // Increase timeout
});
```

### Execution Failed

Check the execution history:

```typescript
const history = orchestrator.getExecutionHistory();
const failed = history.filter(r => !r.success);
console.log(failed[failed.length - 1].result.error);
```

## API Reference

### AgentRegistry

- `initialize()` - Initialize registry with all agents
- `getAgent(name)` - Get agent by name
- `getAgentsByCapability(capability)` - Find agents by capability
- `getAllAgents()` - Get all registered agents
- `findBestAgent(capability)` - Get first agent with capability
- `healthCheckAll()` - Check health of all agents
- `registerAgent(agent)` - Register new agent dynamically
- `listAgents()` - List all agents with details

### AgentOrchestrator

- `initialize()` - Initialize orchestrator
- `executeTask(task)` - Execute single task
- `executeParallel(tasks)` - Execute multiple tasks in parallel
- `executeSequential(tasks, dependencies)` - Execute with dependencies
- `getExecutionHistory(agentName?, limit?)` - Get recent executions
- `getStatistics()` - Get performance statistics
- `listAvailableAgents()` - List all agents
- `healthCheckAll()` - Health check all agents

## License

Part of AuthiChain Unified ecosystem.
