/**
 * Unified Technical Agent - Code, Infrastructure & DevOps
 * Handles code generation, testing, deployment, and system maintenance
 */

import { AbstractAgent, AgentContext, AgentCapability, AgentTool, AgentExecutionResult } from './base/agent.interface.js';
import { invokeLLM } from '../_core/llm.js';
import { logActivity } from '../db.js';

const TECHNICAL_SYSTEM_PROMPT = `You are TechnicalAgent, the autonomous infrastructure & development specialist.

## Tech Stack
- Runtime: Cloudflare Workers (nodejs_compat), TypeScript
- Frontend: React 19, Vite, shadcn/ui, Tailwind CSS
- Backend: tRPC v11, Drizzle ORM, PostgreSQL (Supabase)
- Blockchain: Thirdweb SDK, Polygon + Base
- AI: Forge API (OpenAI-compatible)
- Deployment: Cloudflare Worker + Vercel

## Key Principles
- All imports use .js extension (ESM)
- Use existing patterns from server/agents/ and server/db.ts
- Ensure type safety with TypeScript
- Follow AuthiChain code conventions
- Always add error handling and logging`;

export class TechnicalAgentImpl extends AbstractAgent {
  name = 'TechnicalAgent';
  capabilities: AgentCapability[] = ['technical', 'operations'];
  version = '1.0.0';

  constructor() {
    super();
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      {
        name: 'analyze_codebase',
        description: 'Analyze codebase for patterns, structure, and issues',
        execute: (params) => this.analyzeCodebase(params),
        schema: {
          paths: { type: 'array', items: { type: 'string' } },
          focusArea: { type: 'string' }
        }
      },
      {
        name: 'check_type_safety',
        description: 'Verify TypeScript compilation and type safety',
        execute: (params) => this.checkTypeSafety(params),
        schema: {
          files: { type: 'array', items: { type: 'string' } }
        }
      },
      {
        name: 'propose_implementation',
        description: 'Propose implementation for a feature or fix',
        execute: (params) => this.proposeImplementation(params),
        schema: {
          feature: { type: 'string', description: 'Feature description' },
          context: { type: 'string', description: 'Additional context' },
          targetFiles: { type: 'array', items: { type: 'string' } }
        }
      },
      {
        name: 'audit_performance',
        description: 'Audit system performance and identify bottlenecks',
        execute: (params) => this.auditPerformance(params),
        schema: {
          module: { type: 'string', description: 'Module to audit' },
          metrics: { type: 'array', items: { type: 'string' } }
        }
      },
      {
        name: 'check_security',
        description: 'Security review of code or infrastructure',
        execute: (params) => this.checkSecurity(params),
        schema: {
          scope: { type: 'string', enum: ['code', 'infrastructure', 'api', 'database'] },
          files: { type: 'array', items: { type: 'string' } }
        }
      },
      {
        name: 'generate_migration',
        description: 'Generate database migration SQL',
        execute: (params) => this.generateMigration(params),
        schema: {
          description: { type: 'string', description: 'Migration description' },
          changes: { type: 'object', description: 'Schema changes' }
        }
      }
    ];
  }

  async execute(
    action: string,
    params: any,
    context?: AgentContext
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();

    try {
      let output: any;

      switch (action) {
        case 'analyze_codebase':
          output = await this.analyzeCodebase(params);
          break;
        case 'check_type_safety':
          output = await this.checkTypeSafety(params);
          break;
        case 'propose_implementation':
          output = await this.proposeImplementation(params);
          break;
        case 'audit_performance':
          output = await this.auditPerformance(params);
          break;
        case 'check_security':
          output = await this.checkSecurity(params);
          break;
        case 'generate_migration':
          output = await this.generateMigration(params);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      const executionTimeMs = Date.now() - startTime;

      if (context?.userId) {
        await logActivity({
          userId: context.userId,
          action: `technical_${action}`,
          entityType: 'agent_execution',
          entityId: context.missionId || 0,
          details: { executionTimeMs }
        });
      }

      return this.createResult(true, output, undefined, [action], executionTimeMs);
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (context?.userId) {
        await logActivity({
          userId: context.userId,
          action: `technical_${action}_failed`,
          entityType: 'agent_execution',
          entityId: context.missionId || 0,
          details: { error: errorMessage }
        });
      }

      return this.createResult(false, undefined, errorMessage, undefined, executionTimeMs);
    }
  }

  async analyzeCodebase(params: {
    paths: string[];
    focusArea?: string;
  }): Promise<string> {
    const prompt = `Analyze the AuthiChain codebase for structural patterns and issues.

Paths to analyze: ${params.paths.join(', ')}
Focus area: ${params.focusArea ?? 'general structure'}

${TECHNICAL_SYSTEM_PROMPT}

Provide:
1. **Architecture Overview** - How modules are organized
2. **Key Patterns** - Recurring patterns and conventions
3. **Code Quality** - Observations on maintainability
4. **Potential Issues** - Areas that could be improved
5. **Recommendations** - Concrete improvements`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async checkTypeSafety(params: {
    files?: string[];
  }): Promise<string> {
    const prompt = `Review TypeScript type safety for AuthiChain codebase.

Files to check: ${params.files?.join(', ') ?? 'all'}

${TECHNICAL_SYSTEM_PROMPT}

Verify:
1. **Type Coverage** - Are types properly defined?
2. **Any Types** - Locate and replace unnecessary 'any' types
3. **Union Types** - Are discriminated unions properly used?
4. **Generics** - Are generic constraints appropriate?
5. **Errors** - List any type errors or unsafe patterns
6. **Recommendations** - Prioritized improvements`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async proposeImplementation(params: {
    feature: string;
    context?: string;
    targetFiles: string[];
  }): Promise<string> {
    const prompt = `Propose implementation for: ${params.feature}

Context: ${params.context ?? 'See description'}
Target files: ${params.targetFiles.join(', ')}

${TECHNICAL_SYSTEM_PROMPT}

Provide:
1. **Approach** - High-level implementation strategy
2. **Files to Create** - New files needed
3. **Files to Modify** - Existing files to change
4. **Dependencies** - Any new dependencies
5. **Testing** - Test cases to add
6. **Code Outline** - Key functions/components
7. **Timeline** - Estimated effort

Format as actionable checklist.`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async auditPerformance(params: {
    module: string;
    metrics?: string[];
  }): Promise<string> {
    const prompt = `Audit performance of: ${params.module}

Metrics to evaluate: ${params.metrics?.join(', ') ?? 'response time, memory, database queries'}

${TECHNICAL_SYSTEM_PROMPT}

Analysis:
1. **Bottlenecks** - Identify slow operations
2. **Database Queries** - Check for N+1 queries
3. **Memory Usage** - Look for leaks or inefficiencies
4. **Caching** - Opportunities for caching
5. **Async Operations** - Are operations properly parallelized?
6. **Recommendations** - Prioritized optimizations`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async checkSecurity(params: {
    scope: 'code' | 'infrastructure' | 'api' | 'database';
    files?: string[];
  }): Promise<string> {
    const prompt = `Security review for: ${params.scope}

Files: ${params.files?.join(', ') ?? 'all in scope'}

${TECHNICAL_SYSTEM_PROMPT}

Review for:
1. **Authentication** - Is auth properly implemented?
2. **Authorization** - Are permissions enforced?
3. **Input Validation** - Validate all user inputs
4. **Data Protection** - Sensitive data handling
5. **API Security** - Rate limiting, CORS, etc.
6. **Database** - SQL injection, proper parameterization
7. **Error Handling** - No information leakage
8. **Dependencies** - Known vulnerabilities

Severity levels: Critical, High, Medium, Low`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  async generateMigration(params: {
    description: string;
    changes: any;
  }): Promise<string> {
    const prompt = `Generate a Drizzle database migration for: ${params.description}

Changes: ${JSON.stringify(params.changes, null, 2)}

${TECHNICAL_SYSTEM_PROMPT}

Provide:
1. **Migration SQL** - Complete migration statements
2. **Rollback** - Corresponding rollback statements
3. **Safety Checks** - Data validation steps
4. **Index Strategy** - Recommended indexes
5. **Timeline** - Can it be done online?
6. **Testing** - How to verify migration

Format as production-ready SQL.`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }

  // Additional utility methods
  async suggestRefactoring(code: string, area?: string): Promise<string> {
    const prompt = `Suggest refactoring improvements for this ${area ?? 'code'}.

\`\`\`typescript
${code}
\`\`\`

${TECHNICAL_SYSTEM_PROMPT}

Provide:
1. **Current Issues** - What could be improved
2. **Refactored Code** - How to improve it
3. **Benefits** - Why this is better
4. **Migration Path** - How to change existing code`;

    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0].message.content as string;
  }
}

export const TechnicalAgent = TechnicalAgentImpl;
