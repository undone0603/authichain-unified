/**
 * Base Agent Interface - Unified Architect Pattern
 * All agents conform to this interface for unified orchestration
 */

export type AgentCapability =
  | 'executive'
  | 'technical'
  | 'operations'
  | 'data'
  | 'compliance'
  | 'sales';

export interface AgentTool {
  name: string;
  description: string;
  execute: (params: unknown) => Promise<unknown>;
  schema?: Record<string, unknown>;
}

export interface AgentContext {
  userId?: string | null;
  sessionId?: string;
  missionId?: number;
  taskId?: number;
  metadata?: Record<string, unknown>;
}

export interface AgentExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  toolsUsed?: string[];
  executionTimeMs?: number;
  metadata?: Record<string, unknown>;
}

export interface BaseAgent {
  name: string;
  capabilities: AgentCapability[];
  version: string;
  tools: AgentTool[];

  /**
   * Execute a task with unified context
   */
  execute(
    action: string,
    params: unknown,
    context?: AgentContext
  ): Promise<AgentExecutionResult>;

  /**
   * Get available tools for this agent
   */
  getTools(): AgentTool[];

  /**
   * Validate if agent can handle this capability
   */
  canHandle(capability: AgentCapability): boolean;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}

export abstract class AbstractAgent implements BaseAgent {
  abstract name: string;
  abstract capabilities: AgentCapability[];
  abstract version: string;
  tools: AgentTool[] = [];

  getTools(): AgentTool[] {
    return this.tools;
  }

  canHandle(capability: AgentCapability): boolean {
    return this.capabilities.includes(capability);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  abstract execute(
    action: string,
    params: unknown,
    context?: AgentContext
  ): Promise<AgentExecutionResult>;

  protected createResult(
    success: boolean,
    output?: unknown,
    error?: string,
    toolsUsed?: string[],
    executionTimeMs?: number
  ): AgentExecutionResult {
    return {
      success,
      output,
      error,
      toolsUsed,
      executionTimeMs,
    };
  }
}
