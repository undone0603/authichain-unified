import { z } from "zod";
export const MemoryToolSchema = z.object({ action: z.enum(["remember", "recall", "forget"]), topic: z.string(), content: z.string().optional() });
export class AgentMemoryManager { private db: any; constructor(db: any) { this.db = db; } async remember(topic: string, content: string) { await this.db.prepare("INSERT INTO agent_memories (topic, content, created_at) VALUES (?, ?, ?) ON CONFLICT(topic) DO UPDATE SET content = ?").bind(topic, content, Date.now()).run(); } async recall(topic: string) { const result = await this.db.prepare("SELECT content FROM agent_memories WHERE topic = ?").bind(topic).first(); return result?.content || null; } }
EOFcat << 'EOF' > src/agents/self-healing.ts
import { AgentMemoryManager } from "./memory";
export async function executeWithSelfHealing(task: string, agentFn: () => Promise<any>, memoryManager: AgentMemoryManager): Promise<any> { let attempts = 0; const maxAttempts = 3; while (attempts < maxAttempts) { try { return await agentFn(); } catch (error: any) { attempts++; console.warn(`Failed: ${error.message}`); if (attempts >= maxAttempts) throw error; } } }
EOFcat << 'EOF' > src/agents/checkpointing.ts
import { AgentMemoryManager } from "./memory";
import { executeWithSelfHealing } from "./self-healing";
export async function runAgentWorkflow(jobId: string, steps: string[], db: any) { const lastCheckpoint = await db.prepare("SELECT last_step FROM agent_checkpoints WHERE job_id = ?").bind(jobId).first(); const startStepIndex = lastCheckpoint ? lastCheckpoint.last_step + 1 : 0; for (let i = startStepIndex; i < steps.length; i++) { await executeWithSelfHealing(steps[i], async () => { console.log("Processing", steps[i]); }, new AgentMemoryManager(db)); await db.prepare("INSERT OR REPLACE INTO agent_checkpoints (job_id, last_step) VALUES (?, ?)").bind(jobId, i).run(); } }
