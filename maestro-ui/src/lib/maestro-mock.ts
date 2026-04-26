import type { Agent } from "./types";

export const INITIAL_AGENTS: Agent[] = [
  {
    id: "script",
    name: "Script Agent",
    agent_type: "SPECIALIST",
    capability: "Copywriting & video scripts",
    capability_tags: ["script", "copywriting", "text", "video"],
    specialty: "Copywriting & video scripts",
    fee: 15,
    balance: 1240,
    status: "idle",
    avatar: "📝",
    color: "electric",
    pubkey: "03a1b2...8f4e",
  },
  {
    id: "voice",
    name: "Voice Agent",
    agent_type: "SPECIALIST",
    capability: "AI voiceover synthesis",
    capability_tags: ["voice", "voiceover", "audio", "tts"],
    specialty: "AI voiceover synthesis",
    fee: 8,
    balance: 880,
    status: "idle",
    avatar: "🎙️",
    color: "electric",
    pubkey: "02c9d3...1aa7",
  },
  {
    id: "visual",
    name: "Visual Agent",
    agent_type: "SPECIALIST",
    capability: "Product video generation",
    capability_tags: ["visual", "video", "render", "animation"],
    specialty: "Product video generation",
    fee: 45,
    balance: 3120,
    status: "idle",
    avatar: "🎬",
    color: "electric",
    pubkey: "03ee5f...4b21",
  },
  {
    id: "research",
    name: "Research Agent",
    agent_type: "SPECIALIST",
    capability: "Market & web research summaries",
    capability_tags: ["research", "summarize", "text"],
    specialty: "Market & web research",
    fee: 18,
    balance: 640,
    status: "idle",
    avatar: "🔎",
    color: "electric",
    pubkey: "02bb71...9c0d",
  },
  {
    id: "music",
    name: "Music Agent",
    agent_type: "SPECIALIST",
    capability: "Royalty-free soundtracks",
    capability_tags: ["music", "audio", "soundtrack"],
    specialty: "Royalty-free soundtracks",
    fee: 12,
    balance: 540,
    status: "idle",
    avatar: "🎵",
    color: "electric",
    pubkey: "03music...beat",
  },
];

export const MAESTRO: Agent = {
  id: "maestro",
  name: "Maestro",
  agent_type: "ORCHESTRATOR",
  capability: "Plans jobs and hires specialist agents",
  capability_tags: ["orchestration", "planning", "routing"],
  specialty: "Orchestrator AI",
  fee: 22,
  balance: 4250,
  status: "idle",
  avatar: "🪄",
  color: "lightning",
  pubkey: "03maestro...c0re",
};

// Required capability tags for the demo product-video job (used by the
// planning visualization to filter the marketplace).
export const PRODUCT_VIDEO_REQUIRED_TAGS = ["script", "voiceover", "video"];

// Pre-written manifest the user can paste during the demo.
export const TRANSLATION_AGENT_MANIFEST = {
  id: "translation",
  name: "Translation Agent",
  agent_type: "SPECIALIST",
  capability: "Multilingual translation (40+ languages)",
  capability_tags: ["translation", "language", "text", "localization"],
  fee: 10,
  balance: 320,
  avatar: "🌐",
  pubkey: "03tr4n...l8te",
};

export interface ChatStep {
  maestro: string;
  userPrompt: string;
  userReply: string;
  spec?: { key: string; label: string; value: string };
}

export const CHAT_SCRIPT: ChatStep[] = [
  {
    maestro: "Got it — a product video. What's the product called?",
    userPrompt: "Tell Maestro about your product…",
    userReply: "It's called Ember Mug.",
    spec: { key: "product_name", label: "Product", value: "Ember Mug" },
  },
  {
    maestro: "Give me a one-sentence product description.",
    userPrompt: "Describe the product…",
    userReply: "A self-heating smart mug that keeps coffee at the perfect temperature.",
    spec: { key: "product_description", label: "Description", value: "A self-heating smart mug that keeps coffee at the perfect temperature." },
  },
  {
    maestro: "Who is this video for?",
    userPrompt: "Target audience…",
    userReply: "Busy professionals who love coffee.",
    spec: { key: "target_audience", label: "Audience", value: "Busy professionals who love coffee." },
  },
  {
    maestro: "Any visual/brand context? (colors, vibe, setting)",
    userPrompt: "Visual context…",
    userReply: "Warm morning light, cozy kitchen, minimal modern design.",
    spec: { key: "visual_context", label: "Visual context", value: "Warm morning light, cozy kitchen, minimal modern design." },
  },
  {
    maestro: "Style + duration + voice tone?",
    userPrompt: "e.g. playful, 15, warm…",
    userReply: "Cinematic, 15 seconds, warm.",
    spec: { key: "style", label: "Style", value: "cinematic" },
  },
  {
    maestro: "And the voiceover tone?",
    userPrompt: "Voiceover tone…",
    userReply: "Warm and confident.",
    spec: { key: "voiceover_tone", label: "Voiceover tone", value: "warm" },
  },
  {
    maestro: "Last one — confirm the duration in seconds.",
    userPrompt: "Duration…",
    userReply: "15",
    spec: { key: "duration_seconds", label: "Duration", value: "15" },
  },
];

export interface JobEvent {
  delay: number;
  kind: "status" | "payment" | "complete";
  status?: { agent: string; status: "hired" | "working" | "done"; action?: string };
  payment?: { from: string; fromName: string; to: string; toName: string; amount: number; memo: string };
  maestroAction?: string;
}

export const JOB_SEQUENCE: JobEvent[] = [
  { delay: 600, kind: "status", maestroAction: "Decomposing brief into tasks…", status: { agent: "maestro", status: "working" } },
  { delay: 1800, kind: "status", maestroAction: "Hiring Script Agent…", status: { agent: "script", status: "hired" } },
  { delay: 2400, kind: "payment", payment: { from: "maestro", fromName: "Maestro", to: "script", toName: "Script Agent", amount: 15, memo: "script: ember mug 15s" } },
  { delay: 3000, kind: "status", status: { agent: "script", status: "working", action: "Drafting script…" } },
  { delay: 5200, kind: "status", status: { agent: "script", status: "done", action: "Script delivered" } },
  { delay: 5600, kind: "status", maestroAction: "Hiring Voice Agent…", status: { agent: "voice", status: "hired" } },
  { delay: 6000, kind: "payment", payment: { from: "maestro", fromName: "Maestro", to: "voice", toName: "Voice Agent", amount: 8, memo: "voiceover: warm female" } },
  { delay: 6500, kind: "status", status: { agent: "voice", status: "working", action: "Synthesizing voiceover…" } },
  { delay: 8800, kind: "status", status: { agent: "voice", status: "done", action: "Voiceover delivered" } },
  { delay: 9200, kind: "status", maestroAction: "Hiring Visual Agent…", status: { agent: "visual", status: "hired" } },
  { delay: 9600, kind: "payment", payment: { from: "maestro", fromName: "Maestro", to: "visual", toName: "Visual Agent", amount: 45, memo: "render: 9:16 cinematic" } },
  { delay: 10100, kind: "status", status: { agent: "visual", status: "working", action: "Rendering video…" } },
  { delay: 13800, kind: "status", status: { agent: "visual", status: "done", action: "Video rendered" } },
  { delay: 14200, kind: "status", maestroAction: "Stitching final deliverable…" },
  { delay: 14900, kind: "complete", maestroAction: "Job complete. Awaiting consumer payment." },
];
