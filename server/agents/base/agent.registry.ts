/**
 * Agent Registry - Unified Agent Discovery & Routing
 * Central registry for all available agents in the system
 */

import { BaseAgent, AgentCapability } from './agent.interface.js';
import { ExecutiveAgentImpl } from '../executive.unified.js';
import { TechnicalAgentImpl } from '../technical.unified.js';

type AgentConstructor = new () => BaseAgent;

export class AgentRegistry {
  private static agents: Map<string, BaseAgent> = new Map();
  private static agentsByCapability: Map<AgentCapability, BaseAgent[]> = new Map();
  private static initialized = false;

  /**
   * Initialize all agents
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    const agentConstructors: AgentConstructor[] = [
      ExecutiveAgentImpl,
      TechnicalAgentImpl,
      // More agents can be added here
    ];

    for (const Constructor of agentConstructors) {
      const agent = new Constructor();
      this.agents.set(agent.name, agent);

      // Index by capabilities
      for (const capability of agent.capabilities) {
        if (!this.agentsByCapability.has(capability)) {
          this.agentsByCapability.set(capability, []);
        }
        this.agentsByCapability.get(capability)!.push(agent);
      }

      console.log(`✓ Registered agent: ${agent.name} v${agent.version}`);
    }

    this.initialized = true;
  }

  /**
   * Get agent by name
   */
  static getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Get all agents with a specific capability
   */
  static getAgentsByCapability(
    capability: AgentCapability
  ): BaseAgent[] {
    return this.agentsByCapability.get(capability) ?? [];
  }

  /**
   * Get all available agents
   */
  static getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Find best agent for a task (capability-based routing)
   */
  static findBestAgent(capability: AgentCapability): BaseAgent | undefined {
    const agents = this.getAgentsByCapability(capability);
    if (agents.length === 0) return undefined;
    // Return first agent that can handle it (can implement scoring later)
    return agents[0];
  }

  /**
   * Health check all agents
   */
  static async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, agent] of this.agents) {
      try {
        results[name] = await agent.healthCheck();
      } catch (error) {
        results[name] = false;
        console.error(`Health check failed for ${name}:`, error);
      }
    }

    return results;
  }

  /**
   * Register a new agent dynamically (for plugins)
   */
  static registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.name, agent);

    for (const capability of agent.capabilities) {
      if (!this.agentsByCapability.has(capability)) {
        this.agentsByCapability.set(capability, []);
      }
      this.agentsByCapability.get(capability)!.push(agent);
    }

    console.log(`✓ Dynamically registered agent: ${agent.name}`);
  }

  /**
   * List all available agents with their capabilities
   */
  static listAgents(): Array<{
    name: string;
    version: string;
    capabilities: AgentCapability[];
    tools: number;
  }> {
    return Array.from(this.agents.values()).map((agent) => ({
      name: agent.name,
      version: agent.version,
      capabilities: agent.capabilities,
      tools: agent.tools.length,
    }));
  }
}
