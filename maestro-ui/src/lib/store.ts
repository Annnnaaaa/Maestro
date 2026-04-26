import { create } from "zustand";
import type { Agent, PaymentEvent, SpecField } from "./types";
import { fetchMaestro, fetchMarketplace, markJobPaid, streamExecute, submitJob } from "./backend";

type View = "landing" | "chat" | "ops";
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
  specToInputs: () => Record<string, unknown>;

  consumerKind: ConsumerKind;
  setConsumerKind: (k: ConsumerKind) => void;
  jobNumber: number;
  jobTitle: string;
  jobRequest: string;
  jobStatus: JobStatus;
  maestroAction: string;
  requiredTags: string[];
  matchedAgentIds: string[];
  jobId: string | null;
  pricing: { subtotal: number; margin: number; total: number } | null;
  invoice: { invoice: string; payment_hash: string } | null;
  finalVideoUrl: string | null;

  initFromBackend: () => void;
  startJob: (title: string, kind: ConsumerKind, request: string, inputs: Record<string, unknown>) => Promise<void>;

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

// Planning timing (ms)
const PLAN_REQUEST_IN = 100;
const PLAN_MAESTRO_LIGHT = 700;
const PLAN_LINES_FIRE = 1300;
const PLAN_MATCH_SETTLE = 2400;
const PLAN_HANDOFF = 3400;

export const useMaestro = create<MaestroState>((set, get) => ({
  view: "landing",
  setView: (v) => set({ view: v }),

  spec: [],
  addSpec: (f) =>
    set((s) => (s.spec.some((x) => x.key === f.key) ? s : { spec: [...s.spec, f] })),
  resetSpec: () => set({ spec: [] }),
  specToInputs: () => {
    const inputs: Record<string, unknown> = {};
    for (const f of get().spec) inputs[f.key] = f.value;
    return inputs;
  },

  consumerKind: "human",
  setConsumerKind: (k) => set({ consumerKind: k }),
  jobNumber: 1,
  jobTitle: "",
  jobRequest: "",
  jobStatus: "idle",
  maestroAction: "Standing by",
  requiredTags: [],
  matchedAgentIds: [],
  jobId: null,
  pricing: null,
  invoice: null,
  finalVideoUrl: null,

  initFromBackend: () => {
    // Fire-and-forget hydration; UI stays usable even if backend is offline.
    Promise.all([fetchMaestro(), fetchMarketplace()])
      .then(([m, agents]) => {
        set({
          maestro: m,
          agents,
        });
      })
      .catch(() => {});
  },

  startJob: async (title, kind, request, inputs) => {
    set((s) => ({
      jobTitle: title,
      jobRequest: request,
      jobStatus: "planning",
      consumerKind: kind,
      maestroAction: "Planning job…",
      videoReady: false,
      consumerPaid: false,
      matchedAgentIds: [],
      requiredTags: [],
      payments: [],
      log: [
        {
          id: crypto.randomUUID(),
          text: `Job #${String(s.jobNumber).padStart(3, "0")} received — ${title}`,
          ts: Date.now(),
          kind: "info",
        },
      ],
      jobId: null,
      pricing: null,
      invoice: null,
      finalVideoUrl: null,
      agents: s.agents.map((a) => ({ ...a, status: "idle" as const })),
    }));

    const res = await submitJob(request, inputs);
    if (res.status === "no_capability_match") {
      set({ maestroAction: "No capable agent found", jobStatus: "idle" });
      get().pushLog(`No capability match: ${res.reason}`, "info");
      return;
    }
    if (res.status === "missing_inputs") {
      set({ maestroAction: "Need more inputs", jobStatus: "idle" });
      get().pushLog(`Missing inputs: ${res.missing_inputs.join(", ")}`, "info");
      return;
    }

    const plan = res.plan as any;
    const steps = Array.isArray(plan?.steps) ? plan.steps : [];
    const agentIds = steps.map((s: any) => String(s.agent_id ?? "")).filter(Boolean);
    set({
      maestroAction: "Awaiting payment…",
      jobStatus: "in_progress",
      jobId: res.jobId,
      pricing: res.pricing,
      invoice: res.invoice,
      matchedAgentIds: agentIds,
    });
    get().pushLog(`Planned ${steps.length} step(s). Total: ${res.pricing.total} sats`, "info");
  },

  agents: [],
  maestro: {
    id: "maestro",
    name: "Maestro",
    agent_type: "ORCHESTRATOR",
    capability: "Plans jobs and hires specialist agents",
    capability_tags: ["orchestration"],
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
    const jobId = get().jobId;
    const pricing = get().pricing;
    if (!jobId || !pricing) return;
    if (get().consumerPaid) return;

    set({ consumerPaid: true, maestroAction: "Verifying payment…" });
    markJobPaid(jobId)
      .then(() => {
        get().pushPayment({
          from: get().consumerKind === "human" ? "consumer" : "agent-consumer",
          fromName: get().consumerKind === "human" ? "You" : "MarketingBot",
          to: "maestro",
          toName: "Maestro",
          amount: pricing.total,
          memo: "escrow: job payment",
        });

        set({ maestroAction: "Executing plan…" });
        return streamExecute(jobId, (e) => {
          if (e.step === "planning") {
            set({ maestroAction: "Planning…" });
            return;
          }
          if (e.step === "hiring" && e.agent) {
            get().setAgentStatus(e.agent, "hired");
            set({ maestroAction: `Hiring ${e.agent}…` });
            return;
          }
          if (e.step === "working" && e.agent) {
            get().setAgentStatus(e.agent, "working");
            if (typeof e.paymentSent === "number" && e.paymentSent > 0) {
              get().pushPayment({
                from: "maestro",
                fromName: "Maestro",
                to: e.agent,
                toName: e.agent,
                amount: e.paymentSent,
                memo: e.capability ? `fee: ${e.capability}` : "agent fee",
              });
            }
            if (e.output) {
              const note =
                typeof (e.output as any)?.note === "string" ? String((e.output as any).note) : "";
              get().pushLog(`${e.agent}: output received${note ? ` — ${note}` : ""}`, "status");
              get().setAgentStatus(e.agent, "done");
            }
            return;
          }
          if (e.step === "complete") {
            const final = e.finalOutput as any;
            const maybe =
              final?.["magichour-video-agent"]?.video_url ??
              final?.["json2video-agent"]?.video_url ??
              null;
            set({
              jobStatus: "complete",
              videoReady: true,
              maestroAction: "Job complete ✨",
              finalVideoUrl: typeof maybe === "string" ? maybe : null,
            });
            set((s) => ({ jobsCompleted: s.jobsCompleted + 1 }));
            get().pushLog("Final deliverable ready", "info");
            return;
          }
          if (e.step === "error") {
            set({ maestroAction: "Error", jobStatus: "idle" });
            get().pushLog(`Error: ${e.message ?? "unknown"}`, "info");
          }
        });
      })
      .catch((err) => {
        set({ maestroAction: "Payment failed" });
        get().pushLog(`Payment failed: ${(err as Error).message}`, "info");
      });
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
      consumerPaid: false,
      maestroAction: "Standing by",
      payments: [],
      log: [],
      incomingAgentRequest: false,
      matchedAgentIds: [],
      requiredTags: [],
    })),
}));
