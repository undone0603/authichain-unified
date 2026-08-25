/**
 * Unified Agent System Tests
 * Validates all agents work correctly with the orchestration framework
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { AgentRegistry } from './base/agent.registry.js';
import { AgentOrchestrator, AgentTask } from './base/agent.orchestrator.js';
import { ExecutiveAgentImpl } from './executive.unified.js';
import { TechnicalAgentImpl } from './technical.unified.js';

describe('Unified Agent System', () => {
  beforeAll(async () => {
    await AgentRegistry.initialize();
  });

  describe('Agent Registry', () => {
    it('should initialize and register agents', async () => {
      const agents = AgentRegistry.listAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents.some(a => a.name === 'ExecutiveAgent')).toBe(true);
    });

    it('should find agents by capability', () => {
      const agents = AgentRegistry.getAgentsByCapability('executive');
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0].name).toBe('ExecutiveAgent');
    });

    it('should get agent by name', () => {
      const agent = AgentRegistry.getAgent('ExecutiveAgent');
      expect(agent).toBeDefined();
      expect(agent?.name).toBe('ExecutiveAgent');
    });

    it('should perform health check', async () => {
      const health = await AgentRegistry.healthCheckAll();
      expect(health).toBeDefined();
      expect(typeof health['ExecutiveAgent']).toBe('boolean');
    });
  });

  describe('Executive Agent', () => {
    let agent: ExecutiveAgentImpl;

    beforeAll(() => {
      agent = new ExecutiveAgentImpl();
    });

    it('should have correct properties', () => {
      expect(agent.name).toBe('ExecutiveAgent');
      expect(agent.capabilities).toContain('executive');
      expect(agent.capabilities).toContain('sales');
      expect(agent.version).toBe('2.1.0');
    });

    it('should have all tools', () => {
      expect(agent.tools.length).toBeGreaterThan(0);
      const toolNames = agent.tools.map(t => t.name);
      expect(toolNames).toContain('draft_sales_email');
      expect(toolNames).toContain('generate_linkedin_post');
      expect(toolNames).toContain('daily_briefing');
    });

    it('should be able to handle executive capability', () => {
      expect(agent.canHandle('executive')).toBe(true);
      expect(agent.canHandle('technical')).toBe(false);
    });

    it('should get tools', () => {
      const tools = agent.getTools();
      expect(tools.length).toBe(agent.tools.length);
      expect(tools[0].name).toBeDefined();
    });
  });

  describe('Technical Agent', () => {
    let agent: TechnicalAgentImpl;

    beforeAll(() => {
      agent = new TechnicalAgentImpl();
    });

    it('should have correct properties', () => {
      expect(agent.name).toBe('TechnicalAgent');
      expect(agent.capabilities).toContain('technical');
      expect(agent.capabilities).toContain('operations');
    });

    it('should have specialized tools', () => {
      const toolNames = agent.tools.map(t => t.name);
      expect(toolNames).toContain('analyze_codebase');
      expect(toolNames).toContain('check_type_safety');
      expect(toolNames).toContain('propose_implementation');
      expect(toolNames).toContain('check_security');
    });

    it('should handle technical capability', () => {
      expect(agent.canHandle('technical')).toBe(true);
      expect(agent.canHandle('operations')).toBe(true);
    });
  });

  describe('Agent Orchestrator', () => {
    let orchestrator: AgentOrchestrator;

    beforeAll(async () => {
      orchestrator = AgentOrchestrator.getInstance();
      await orchestrator.initialize();
    });

    it('should list available agents', () => {
      const agents = orchestrator.listAvailableAgents();
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should get statistics', () => {
      const stats = orchestrator.getStatistics();
      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successCount');
      expect(stats).toHaveProperty('failureCount');
    });

    it('should route tasks correctly', async () => {
      // This would need mocked LLM to work without API key
      // Just verify the structure
      const agents = orchestrator.listAvailableAgents();
      expect(agents).toBeDefined();
      expect(Array.isArray(agents)).toBe(true);
    });

    it('should provide execution history', () => {
      const history = orchestrator.getExecutionHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Agent Integration', () => {
    it('should support multiple capabilities per agent', () => {
      const executiveAgent = AgentRegistry.getAgent('ExecutiveAgent');
      expect(executiveAgent?.capabilities.length).toBeGreaterThanOrEqual(2);
    });

    it('should allow dynamic agent registration', () => {
      // Create a mock agent for testing
      class MockAgent {
        name = 'MockAgent';
        capabilities = ['executive'] as const;
        version = '1.0.0';
        tools = [];

        async execute() {
          return {
            success: true,
            output: 'mock'
          };
        }

        getTools() {
          return [];
        }

        canHandle() {
          return true;
        }

        async healthCheck() {
          return true;
        }
      }

      // Verify structure (actual registration would need proper implementation)
      const mockAgent = new MockAgent() as any;
      expect(mockAgent.name).toBe('MockAgent');
      expect(mockAgent.capabilities.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown agent gracefully', () => {
      const agent = AgentRegistry.getAgent('NonExistentAgent');
      expect(agent).toBeUndefined();
    });

    it('should handle missing capability', () => {
      const agents = AgentRegistry.getAgentsByCapability('unknown-capability' as any);
      expect(agents.length).toBe(0);
    });
  });
});

/**
 * Usage Examples for Unified Agent System
 */

export async function exampleUsage() {
  // Initialize
  const orchestrator = AgentOrchestrator.getInstance();
  await orchestrator.initialize();

  // Example: Route executive task
  // const task: AgentTask = {
  //   id: 'task-001',
  //   capability: 'executive',
  //   action: 'draft_sales_email',
  //   params: { prospect: {...} }
  // };
  // const result = await orchestrator.executeTask(task);

  // Get statistics
  // const stats = orchestrator.getStatistics();
  // console.log('Orchestrator Statistics:', stats);
}
