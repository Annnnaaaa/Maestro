export type AgentId = "maestro" | "script" | "voice" | "visual" | "consumer" | "agent-consumer" | string;

export type AgentType = "ORCHESTRATOR" | "SPECIALIST";

export interface Agent {
  id: AgentId;
  name: string;
  agent_type: AgentType;
  capability: string;          // human-readable capability label
  capability_tags: string[];   // machine tags used for matching
  specialty: string;
  fee: number;
  balance: number;
  status: "idle" | "hired" | "working" | "done";
  avatar: string; // emoji
  color: "lightning" | "electric" | "agent" | "success";
  pubkey: string;
}

export interface PaymentEvent {
  id: string;
  from: AgentId;
  fromName: string;
  to: AgentId;
  toName: string;
  amount: number;
  memo: string;
  hash: string;
  timestamp: number;
}

export interface SpecField {
  key: string;
  label: string;
  value: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "maestro";
  content: string;
}
