import { create } from "zustand";
import type { Agent, PaymentEvent, SpecField } from "./types";
import { fetchMaestro, fetchMarketplace, streamExecute, submitJob } from "./backend";

type View = "chat" | "ops";
type ConsumerKind = "human" | "agent";
type JobStatus = "idle" | "planning" | "in_progress" | "complete";

interface JobLogEntry {
  id: string;
  text: string;
  ts: number;
  kind: "info" | "status";
}

interface MaestroState {
  view: View;
  setView: (v: View) => void;

  spec: SpecField[];
  addSpec: (f: SpecField) => void;
  resetSpec: () => void;

  consumerKind: ConsumerKind;
  setConsumerKind: (k: ConsumerKind) => void;
  jobNumber: number;
  jobTitle: string;
  jobRequest: string;
  jobStatus: JobStatus;
  maestroAction: string;
  matchedAgentIds: string[];
  finalVideoUrl: string | null;
  pricing: { subtotal: number; margin: number; total: number } | null;
  startJob: (title: string, kind: ConsumerKind, request?: string) => Promise<void>;
  syncMarketplace: () => Promise<void>;

  agents: Agent[];
  maestro: Agent;
  upsertAgent: (a: Agent) => void;
  setAgentStatus: (id: string, status: Agent["status"]) => void;

  payments: PaymentEvent[];
  pushPayment: (p: Omit<PaymentEvent, "id" | "timestamp" | "hash">) => void;

  log: JobLogEntry[];
  pushLog: (text: string, kind?: "info" | "status") => void;

  gmv: number;
  jobsCompleted: number;

  videoReady: boolean;
  consumerPaid: boolean;
  payMaestro: () => void;

  incomingAgentRequest: boolean;
  setIncomingAgentRequest: (v: boolean) => void;

  capabilityToast: string | null;
  setCapabilityToast: (v: string | null) => void;

  resetForNextJob: () => void;
}

const randHash = () =>
  Array.from({ length: 12 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

function inputsFromSpec(spec: SpecField[]): Record<string, unknown> {
  const m = new Map(spec.map((s) => [s.key, s.value]));
  const durationRaw = m.get("duration_seconds") ?? m.get("duration") ?? "";
  const durationNum =
    typeof durationRaw === "string"
      ? parseFloat(durationRaw.replace(/[^\d.]/g, ""))
      : Number(durationRaw);
  const duration_seconds = Number.isFinite(durationNum) && durationNum > 0 ? durationNum : 15;

  return {
    product_name: m.get("product_name") ?? "Demo Product",
    product_description: m.get("product_description") ?? "A short demo product description.",
    target_audience: m.get("target_audience") ?? "general audience",
    visual_context: m.get("visual_context") ?? "clean, modern, high-contrast",
    style: m.get("style") ?? "playful",
    duration_seconds,
    voiceover_tone: m.get("voiceover_tone") ?? m.get("voiceover") ?? "warm",
  };
}

export const useMaestro = create<MaestroState>((set, get) => ({
  view: "chat",
  setView: (v) => set({ view: v }),

  spec: [],
  addSpec: (f) =>
    set((s) => (s.spec.some((x) => x.key === f.key) ? s : { spec: [...s.spec, f] })),
  resetSpec: () => set({ spec: [] }),

  consumerKind: "human",
  setConsumerKind: (k) => set({ consumerKind: k }),
  jobNumber: 1,
  jobTitle: "",
  jobRequest: "",
  jobStatus: "idle",
  maestroAction: "Standing by",
  matchedAgentIds: [],
  finalVideoUrl: null,
  pricing: null,

  syncMarketplace: async () => {
    const [maestro, agents] = await Promise.all([fetchMaestro(), fetchMarketplace()]);
    set({
      maestro,
      agents: agents.filter((a) => a.id !== maestro.id && a.agent_type === "SPECIALIST"),
    });
  },

  startJob: async (title, kind, request) => {
    const req = request ?? title;

    set((s) => ({
      jobTitle: title,
      jobRequest: req,
      jobStatus: "planning",
      consumerKind: kind,
      maestroAction: "Submitting job to Maestro…",
      videoReady: false,
      finalVideoUrl: null,
      pricing: null,
      consumerPaid: false,
      matchedAgentIds: [],
      log: [
        {
          id: crypto.randomUUID(),
          text: `Job #${String(s.jobNumber).padStart(3, "0")} received — ${title}`,
          ts: Date.now(),
          kind: "info",
        },
      ],
      payments: [],
      agents: s.agents.map((a) => ({ ...a, status: "idle" as const })),
    }));

    try {
      await get().syncMarketplace();
    } catch (err) {
      set({ maestroAction: `Backend offline: ${(err as Error).message}`, jobStatus: "idle" });
      return;
    }

    const inputs = inputsFromSpec(get().spec);
    const jobResp = await submitJob(req, inputs);

    if (jobResp.status === "missing_inputs") {
      set({ jobStatus: "idle", maestroAction: "Missing inputs" });
      get().pushLog(`Missing inputs: ${jobResp.missing_inputs.join(", ")}`, "info");
      return;
    }
    if (jobResp.status === "no_capability_match") {
      set({ jobStatus: "idle", maestroAction: "No capability match" });
      get().pushLog(jobResp.reason, "info");
      return;
    }

    set({ maestroAction: "Plan ready. Executing…", jobStatus: "in_progress" });
    set({ pricing: jobResp.pricing });

    get().pushPayment({
      from: kind === "human" ? "consumer" : "agent-consumer",
      fromName: kind === "human" ? "You" : "MarketingBot",
      to: get().maestro.id,
      toName: get().maestro.name,
      amount: jobResp.pricing.total,
      memo: "escrow: maestro job",
    });

    await streamExecute(jobResp.jobId, (evt) => {
      if (evt.step === "planning") {
        set({ maestroAction: "Planning…", jobStatus: "planning" });
        return;
      }
      if (evt.step === "hiring" && evt.agent) {
        set({ maestroAction: `Hiring ${evt.agent}…` });
        get().setAgentStatus(evt.agent, "hired");
        set((s) => ({
          matchedAgentIds: Array.from(new Set([...s.matchedAgentIds, evt.agent!])),
        }));
        return;
      }
      if (evt.step === "working" && evt.agent) {
        if (typeof evt.paymentSent === "number") {
          get().pushPayment({
            from: get().maestro.id,
            fromName: get().maestro.name,
            to: evt.agent,
            toName: evt.agent,
            amount: evt.paymentSent,
            memo: evt.capability ?? "agent fee",
          });
          get().setAgentStatus(evt.agent, "working");
        }
        if (evt.output !== undefined) {
          get().setAgentStatus(evt.agent, "done");
          get().pushLog(`${evt.agent}: delivered output`, "status");
        }
        return;
      }
      if (evt.step === "complete") {
        const out = evt.finalOutput as any;
        const url =
          out?.["json2video-agent"]?.video_url ??
          out?.["json2video-agent-v1"]?.video_url ??
          out?.video_url ??
          null;
        set({
          jobStatus: "complete",
          videoReady: true,
          finalVideoUrl: typeof url === "string" ? url : null,
          maestroAction: "Job complete ✨",
        });
        get().pushLog("Final deliverable ready", "info");
        return;
      }
      if (evt.step === "error") {
        set({ jobStatus: "idle", maestroAction: evt.message ?? "Error" });
      }
    });
  },

  agents: [],
  maestro: {
    id: "maestro",
    name: "Maestro",
    agent_type: "ORCHESTRATOR",
    capability: "orchestrator",
    capability_tags: ["orchestrator"],
    specialty: "Orchestrator AI",
    fee: 0,
    balance: 0,
    status: "idle",
    avatar: "🪄",
    color: "lightning",
    pubkey: "03…",
  },
  upsertAgent: (a) =>
    set((s) => {
      const exists = s.agents.find((x) => x.id === a.id);
      return exists
        ? { agents: s.agents.map((x) => (x.id === a.id ? a : x)) }
        : { agents: [...s.agents, a] };
    }),
  setAgentStatus: (id, status) =>
    set((s) => {
      if (id === "maestro") return { maestro: { ...s.maestro, status } };
      return { agents: s.agents.map((a) => (a.id === id ? { ...a, status } : a)) };
    }),

  payments: [],
  pushPayment: (p) => {
    const evt: PaymentEvent = {
      ...p,
      id: crypto.randomUUID(),
      hash: randHash(),
      timestamp: Date.now(),
    };
    set((s) => {
      const adjust = (a: Agent): Agent => {
        if (a.id === p.from) return { ...a, balance: a.balance - p.amount };
        if (a.id === p.to) return { ...a, balance: a.balance + p.amount };
        return a;
      };
      return {
        payments: [evt, ...s.payments].slice(0, 40),
        agents: s.agents.map(adjust),
        maestro: adjust(s.maestro),
        gmv: s.gmv + p.amount,
        log: [
          { id: crypto.randomUUID(), text: `⚡ ${p.fromName} → ${p.toName}: ${p.amount} sats`, ts: Date.now(), kind: "info" as const },
          ...s.log,
        ].slice(0, 60),
      };
    });
  },

  log: [],
  pushLog: (text, kind = "info") =>
    set((s) => ({
      log: [{ id: crypto.randomUUID(), text, ts: Date.now(), kind }, ...s.log].slice(0, 60),
    })),

  gmv: 0,
  jobsCompleted: 0,

  videoReady: false,
  consumerPaid: false,
  payMaestro: () => {
    if (get().consumerPaid) return;
    set({ consumerPaid: true });
    set((s) => ({ jobsCompleted: s.jobsCompleted + 1 }));
    setTimeout(() => {
      if (get().consumerKind === "human") set({ incomingAgentRequest: true });
    }, 1500);
  },

  incomingAgentRequest: false,
  setIncomingAgentRequest: (v) => set({ incomingAgentRequest: v }),

  capabilityToast: null,
  setCapabilityToast: (v) => set({ capabilityToast: v }),

  resetForNextJob: () =>
    set((s) => ({
      jobNumber: s.jobNumber + 1,
      jobStatus: "idle",
      videoReady: false,
      finalVideoUrl: null,
      pricing: null,
      consumerPaid: false,
      maestroAction: "Standing by",
      payments: [],
      log: [],
      incomingAgentRequest: false,
      matchedAgentIds: [],
    })),
}));

// Best-effort initial sync on load.
void (async () => {
  try {
    await useMaestro.getState().syncMarketplace();
  } catch {
    // ignore
  }
})();
