import { create } from "zustand";
import type { Agent, PaymentEvent, SpecField } from "./types";
import { INITIAL_AGENTS, MAESTRO, JOB_SEQUENCE, PRODUCT_VIDEO_REQUIRED_TAGS } from "./maestro-mock";

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
  requiredTags: string[];
  matchedAgentIds: string[];
  startJob: (title: string, kind: ConsumerKind, request?: string, requiredTags?: string[]) => void;

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
  requiredTags: [],
  matchedAgentIds: [],

  startJob: (title, kind, request, requiredTags) => {
    const tags = requiredTags ?? PRODUCT_VIDEO_REQUIRED_TAGS;
    set((s) => ({
      jobTitle: title,
      jobRequest: request ?? title,
      jobStatus: "planning",
      consumerKind: kind,
      maestroAction: "Reading request…",
      videoReady: false,
      consumerPaid: false,
      requiredTags: tags,
      matchedAgentIds: [],
      log: [{ id: crypto.randomUUID(), text: `Job #${String(s.jobNumber).padStart(3, "0")} received — ${title}`, ts: Date.now(), kind: "info" }],
      payments: [],
      agents: s.agents.map((a) => ({ ...a, status: "idle" as const })),
    }));

    // PLANNING PHASE
    setTimeout(() => set({ maestroAction: "Scanning marketplace for capabilities…" }), PLAN_MAESTRO_LIGHT);

    setTimeout(() => {
      const matches = get().agents
        .filter((a) => a.capability_tags.some((t) => tags.includes(t)))
        .map((a) => a.id);
      set({ matchedAgentIds: matches, maestroAction: `Matched ${matches.length} specialists` });
      get().pushLog(`Capability match: [${tags.join(", ")}] → ${matches.length} agents`, "info");
    }, PLAN_LINES_FIRE);

    setTimeout(() => {
      const n = get().matchedAgentIds.length;
      set({ maestroAction: `Plan: hire ${n} specialists. Executing…` });
    }, PLAN_MATCH_SETTLE);

    // EXECUTION PHASE
    setTimeout(() => {
      set({ jobStatus: "in_progress" });
      get().pushPayment({
        from: kind === "human" ? "consumer" : "agent-consumer",
        fromName: kind === "human" ? "You" : "MarketingBot",
        to: "maestro",
        toName: "Maestro",
        amount: 90,
        memo: "escrow: product video",
      });

      JOB_SEQUENCE.forEach((evt) => {
        setTimeout(() => {
          if (evt.maestroAction) set({ maestroAction: evt.maestroAction });
          if (evt.kind === "status" && evt.status) {
            get().setAgentStatus(evt.status.agent, evt.status.status);
            if (evt.status.action) get().pushLog(`${evt.status.agent}: ${evt.status.action}`, "status");
          }
          if (evt.kind === "payment" && evt.payment) {
            get().pushPayment(evt.payment);
          }
          if (evt.kind === "complete") {
            set({ jobStatus: "complete", videoReady: true, maestroAction: "Job complete ✨" });
            get().pushLog("Final deliverable ready", "info");
          }
        }, evt.delay);
      });
    }, PLAN_HANDOFF);
  },

  agents: INITIAL_AGENTS,
  maestro: MAESTRO,
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
      consumerPaid: false,
      maestroAction: "Standing by",
      payments: [],
      log: [],
      incomingAgentRequest: false,
      matchedAgentIds: [],
      requiredTags: [],
    })),
}));
