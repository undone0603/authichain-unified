import fs from 'fs';
import path from 'path';

const MEMORY_FILE = path.join(process.cwd(), '.agentz-memory.json');

export interface AgentInsight {
    agentId: string;
    domain: string;
    insight: string;
    timestamp: number;
}

export const KnowledgeBase = {
    // Read the collective knowledge
    readCollective: (): AgentInsight[] => {
        if (!fs.existsSync(MEMORY_FILE)) return [];
        return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    },
    
    // An agent deposits new understanding into the swarm
    depositInsight: (agentId: string, domain: string, insight: string) => {
        const memory = KnowledgeBase.readCollective();
        memory.push({ agentId, domain, insight, timestamp: Date.now() });
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
        console.log(`🧠 [Swarm] ${agentId} contributed new knowledge to the collective: [${domain}]`);
    }
};
