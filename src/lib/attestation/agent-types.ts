export type AgentRole =
  "VERIFIER" | "ISSUER" | "WORKER" | "ORCHESTRATOR" | "SYSTEM";

export interface AgentCapability {
  action: string;
  resource: string;
  conditions?: Record<string, any>;
}

export interface AgentIdentity {
  agentId: string;
  name: string;
  role: AgentRole;
  publicKey: string;
  capabilities: AgentCapability[];
  createdAt: string;
}

export interface AgentMessage {
  messageId: string;
  agentId: string;
  recipientId?: string;
  action: string;
  payload: Record<string, any>;
  timestamp: string;
}

export interface SignedAgentMessage {
  message: AgentMessage;
  signature: string;
  publicKey: string;
}
