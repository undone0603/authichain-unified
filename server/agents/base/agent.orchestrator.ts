/**
 * Unified Orchestrator - Coordinates multi-agent execution
 * Routes tasks to appropriate agents and manages execution flow
 */

import { AgentRegistry } from './agent.registry.js';
import { BaseAgent, AgentContext, AgentCapability, AgentExecutionResult } from './agent.interface.js';
import { logActivity } from '../../db.js';

export interface AgentTask {
  id: string;
  capability: AgentCapability;
  action: string;
  params: any;
  context?: AgentContext;
  retries?: number;
  timeout?: number;
}

export interface OrchestrationResult {
  taskId: string;
  agent: string;
  success: boolean;
  result: AgentExecutionResult;
  executedAt: string;
  duration: number;
}

export class AgentOrchestrator {
  private static instance: AgentOrchestrator;
  private executionHistory: OrchestrationResult[] = [];
  private readonly maxHistorySize = 1000;

  private constructor() {}

  static getInstance(): AgentOrchestrator {
    if (!this.instance) {
      this.instance = new AgentOrchestrator();
    }
    return this.instance;
  }

  /**
   * Initialize orchestrator with agent registry
   */
  async initialize(): Promise<void> {
    await AgentRegistry.initialize();
    console.log('✓ Agent Orchestrator initialized');
  }

  /**
   * Execute a task with capability-based routing
   */
  async executeTask(task: AgentTask): Promise<OrchestrationResult> {
    const startTime = Date.now();

    try {
      // Find agent for this capability
      const agent = AgentRegistry.findBestAgent(task.capability);
      if (!agent) {
        throw new Error(`No agent found for capability: ${task.capability}`);
      }

      console.log(`[Orchestrator] Routing ${task.id} to ${agent.name}`);

      // Execute with timeout
      let result: AgentExecutionResult;
      if (task.timeout) {
        result = await this.executeWithTimeout(
          () => agent.execute(task.action, task.params, task.context),
          task.timeout
        );
      } else {
        result = await agent.execute(task.action, task.params, task.context);
      }

      const duration = Date.now() - startTime;
      const orchestrationResult: OrchestrationResult = {
        taskId: task.id,
        agent: agent.name,
        success: result.success,
        result,
        executedAt: new Date().toISOString(),
        duration
      };

      this.recordExecution(orchestrationResult);

      return orchestrationResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const orchestrationResult: OrchestrationResult = {
        taskId: task.id,
        agent: 'unknown',
        success: false,
        result: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          executionTimeMs: duration
        },
        executedAt: new Date().toISOString(),
        duration
      };

      this.recordExecution(orchestrationResult);
      return orchestrationResult;
    }
  }

  /**
   * Execute multiple tasks in parallel
   */
  async executeParallel(tasks: AgentTask[]): Promise<OrchestrationResult[]> {
    const results = await Promise.all(
      tasks.map(task => this.executeTask(task))
    );
    return results;
  }

  /**
   * Execute tasks sequentially with dependency support
   */
  async executeSequential(
    tasks: AgentTask[],
    dependencies?: Record<string, string[]>
  ): Promise<OrchestrationResult[]> {
    const results: Map<string, OrchestrationResult> = new Map();
    const completed: Set<string> = new Set();

    for (const task of tasks) {
      // Check dependencies
      const deps = dependencies?.[task.id] || [];
      const allDepsResolved = deps.every(depId => completed.has(depId));

      if (!allDepsResolved) {
        throw new Error(`Task ${task.id} has unresolved dependencies`);
      }

      const result = await this.executeTask(task);
      results.set(task.id, result);
      completed.add(task.id);

      // If task failed and no retries left, stop
      if (!result.success && (!task.retries || task.retries === 0)) {
        console.error(`Task ${task.id} failed, stopping sequential execution`);
        break;
      }
    }

    return Array.from(results.values());
  }

  /**
   * Execute with timeout
   */
  private executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Task timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      )
    ]);
  }

  /**
   * Record execution result
   */
  private recordExecution(result: OrchestrationResult): void {
    this.executionHistory.push(result);

    // Keep history size bounded
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(
    agentName?: string,
    limit?: number
  ): OrchestrationResult[] {
    let history = this.executionHistory;

    if (agentName) {
      history = history.filter(r => r.agent === agentName);
    }

    if (limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * Get execution statistics
   */
  getStatistics(): {
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    averageDuration: number;
    byAgent: Record<string, { count: number; success: number; avgDuration: number }>;
  } {
    const history = this.executionHistory;

    const stats = {
      totalExecutions: history.length,
      successCount: history.filter(r => r.success).length,
      failureCount: history.filter(r => !r.success).length,
      averageDuration: history.length > 0
        ? history.reduce((sum, r) => sum + r.duration, 0) / history.length
        : 0,
      byAgent: {} as Record<string, { count: number; success: number; avgDuration: number }>
    };

    // Group by agent
    for (const result of history) {
      if (!stats.byAgent[result.agent]) {
        stats.byAgent[result.agent] = { count: 0, success: 0, avgDuration: 0 };
      }
      stats.byAgent[result.agent].count++;
      if (result.success) stats.byAgent[result.agent].success++;
      stats.byAgent[result.agent].avgDuration =
        (stats.byAgent[result.agent].avgDuration * (stats.byAgent[result.agent].count - 1) +
          result.duration) / stats.byAgent[result.agent].count;
    }

    return stats;
  }

  /**
   * List available agents
   */
  listAvailableAgents(): ReturnType<typeof AgentRegistry.listAgents> {
    return AgentRegistry.listAgents();
  }

  /**
   * Health check all agents
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    return AgentRegistry.healthCheckAll();
  }
}

// Export singleton instance
export const orchestrator = AgentOrchestrator.getInstance();
