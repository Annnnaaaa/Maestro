import { motion, AnimatePresence } from "framer-motion";
import { useMaestro } from "@/lib/store";
import { AnimatedCounter } from "./AnimatedCounter";
import { Zap, Bot, User, Wand2, Plus, X, CheckCircle2, Loader2, Sparkles, Crown } from "lucide-react";
import { useEffect, useState } from "react";
import type { Agent } from "@/lib/types";
import { TRANSLATION_AGENT_MANIFEST } from "@/lib/maestro-mock";

export function OperationsDashboard({ onAddAgent }: { onAddAgent: () => void }) {
  const {
    jobNumber, jobTitle, jobRequest, jobStatus, maestroAction,
    maestro, agents, payments, log,
    consumerKind, videoReady, consumerPaid, payMaestro,
    incomingAgentRequest, setIncomingAgentRequest, startJob, resetForNextJob,
    requiredTags, matchedAgentIds, capabilityToast, setCapabilityToast,
  } = useMaestro();

  // Auto-dismiss capability toast
  useEffect(() => {
    if (!capabilityToast) return;
    const t = setTimeout(() => setCapabilityToast(null), 5000);
    return () => clearTimeout(t);
  }, [capabilityToast, setCapabilityToast]);

  const planning = jobStatus === "planning";

  return (
    <div className="grid-bg min-h-[calc(100svh-65px)]">
      <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 sm:space-y-6 sm:px-6 sm:py-6">
        {/* Banner */}
        <motion.div
          layout
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border gradient-surface p-3 shadow-elevated sm:p-4"
        >
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="font-mono text-[10px] tracking-wider text-muted-foreground sm:text-xs">
              JOB #{String(jobNumber).padStart(3, "0")}
            </div>
            <div className="text-sm font-semibold sm:text-base">
              {jobTitle || "Awaiting brief…"}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ConsumerBadge kind={consumerKind} />
            <StatusPill status={jobStatus} />
          </div>
        </motion.div>

        {/* MARKETPLACE - full-width grid of agent cards */}
        <div className="rounded-2xl border border-border bg-surface/60 p-4 shadow-elevated sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground">AGENT MARKETPLACE</h3>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {agents.length + 1} agents registered · 1 orchestrator · {agents.length} specialists
              </p>
            </div>
            <button
              onClick={onAddAgent}
              className="flex items-center gap-1.5 rounded-lg border border-electric/40 bg-electric/10 px-3 py-1.5 text-xs font-semibold text-electric transition-colors hover:bg-electric/20"
            >
              <Plus className="h-3.5 w-3.5" /> Add Agent
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AgentCard
              agent={maestro}
              action={maestroAction}
              isMaestro
              dimmed={false}
              highlighted={planning || jobStatus === "in_progress" || jobStatus === "complete"}
            />
            <AnimatePresence>
              {agents.map((a) => {
                const isMatch = matchedAgentIds.includes(a.id);
                const dim = (planning || jobStatus === "in_progress") && matchedAgentIds.length > 0 && !isMatch;
                const highlight = (planning || jobStatus === "in_progress") && isMatch;
                return (
                  <AgentCard
                    key={a.id}
                    agent={a}
                    dimmed={dim}
                    highlighted={highlight}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Activity + Final output */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <FinalOutput
            ready={videoReady}
            paid={consumerPaid}
            onPay={payMaestro}
            onNext={resetForNextJob}
            jobStatus={jobStatus}
          />

          <div className="rounded-2xl border border-border bg-surface/60 p-4 shadow-elevated">
            <SectionHeader label="ACTIVITY LOG" count={payments.length} />
            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {payments.length === 0 && log.length === 0 && (
                  <p className="font-mono text-[11px] text-muted-foreground">No activity yet.</p>
                )}
                {payments.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: -16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="animate-flash rounded-lg border border-electric/40 bg-background/60 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-lightning" fill="currentColor" />
                        <span className="text-xs font-medium">{p.fromName}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-xs font-medium">{p.toName}</span>
                      </div>
                      <span className="font-mono text-sm font-bold text-lightning">+{p.amount}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-muted-foreground truncate">{p.memo}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{timeAgo(p.timestamp)}</span>
                    </div>
                    <div className="mt-1 font-mono text-[9px] text-muted-foreground/70 truncate">
                      hash: {p.hash}
                    </div>
                  </motion.div>
                ))}
                {log.filter((l) => !l.text.startsWith("⚡")).slice(0, 10).map((l) => (
                  <motion.div
                    key={l.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-md border border-border/50 bg-background/30 px-3 py-1.5 font-mono text-[10px] text-muted-foreground"
                  >
                    › {l.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Planning Overlay */}
      <AnimatePresence>
        {planning && (
          <PlanningOverlay
            request={jobRequest || jobTitle}
            requiredTags={requiredTags}
            matched={matchedAgentIds}
            agents={agents}
            maestroAction={maestroAction}
          />
        )}
      </AnimatePresence>

      {/* Incoming agent notification */}
      <AnimatePresence>
        {incomingAgentRequest && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-agent/50 bg-surface-elevated p-4 shadow-[0_0_32px_-8px_var(--agent)] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-80"
          >
            <div className="mb-2 flex items-center gap-2">
              <Bot className="h-4 w-4 text-agent" />
              <span className="text-sm font-semibold">Incoming agent request</span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              <span className="font-mono text-agent">MarketingBot</span> wants to hire you for an explainer video. Auto-handle?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIncomingAgentRequest(false);
                  resetForNextJob();
                  setTimeout(() => startJob("Explainer Video for MarketingBot", "agent", "Need a 30s explainer video for our SaaS launch."), 300);
                }}
                className="flex-1 rounded-lg bg-agent/20 py-2 text-xs font-semibold text-agent hover:bg-agent/30 border border-agent/40"
              >
                Yes - auto-handle
              </button>
              <button
                onClick={() => setIncomingAgentRequest(false)}
                className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capability detect toast */}
      <AnimatePresence>
        {capabilityToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-lightning/50 bg-surface-elevated p-4 shadow-lightning sm:inset-x-auto sm:bottom-6 sm:left-6 sm:max-w-sm"
          >
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-lightning" />
              <span className="text-sm font-semibold">Maestro detects new capability</span>
            </div>
            <p className="font-mono text-xs text-lightning">{capabilityToast}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Future jobs requiring this capability can now be routed automatically.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function PlanningOverlay({
  request, requiredTags, matched, agents, maestroAction,
}: {
  request: string;
  requiredTags: string[];
  matched: string[];
  agents: Agent[];
  maestroAction: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-background/85 p-4 backdrop-blur-md sm:items-center sm:p-6"
    >
      <div className="w-full max-w-3xl space-y-4 py-4 sm:space-y-5 sm:py-0">
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">PLANNING</div>
          <h2 className="mt-1 text-lg font-bold sm:text-xl">Maestro is matching capabilities…</h2>
        </div>

        {/* Request card */}
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mx-auto max-w-md rounded-2xl border border-electric/40 bg-surface p-4 shadow-electric"
        >
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] tracking-wider text-muted-foreground">
            <User className="h-3 w-3" /> CONSUMER REQUEST
          </div>
          <p className="text-sm">{request}</p>
        </motion.div>

        {/* Maestro */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mx-auto flex w-fit items-center gap-3 rounded-2xl border border-lightning/60 bg-surface px-5 py-3 shadow-lightning animate-pulse-glow"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-lightning text-xl">🪄</div>
          <div>
            <div className="text-sm font-bold">Maestro</div>
            <motion.div key={maestroAction} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono text-[10px] text-lightning">
              {maestroAction}
            </motion.div>
          </div>
        </motion.div>

        {/* Required tags */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground">REQUIRES:</span>
          {requiredTags.map((t) => (
            <motion.span
              key={t}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-full border border-electric/50 bg-electric/10 px-2.5 py-0.5 font-mono text-[10px] text-electric"
            >
              {t}
            </motion.span>
          ))}
        </div>

        {/* Marketplace mini-grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {agents.map((a, i) => {
            const isMatch = matched.includes(a.id);
            const decided = matched.length > 0;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: decided ? (isMatch ? 1 : 0.25) : 0.85,
                  scale: decided && isMatch ? 1.04 : 1,
                  y: 0,
                }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className={`rounded-xl border p-2.5 text-center transition-all ${
                  decided && isMatch
                    ? "border-lightning/60 bg-lightning/10 shadow-lightning"
                    : "border-border bg-surface"
                }`}
              >
                <div className="text-2xl">{a.avatar}</div>
                <div className="mt-1 text-[11px] font-semibold truncate">{a.name}</div>
                {decided && isMatch && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-1 flex items-center justify-center gap-1 font-mono text-[9px] text-lightning"
                  >
                    <Zap className="h-2.5 w-2.5" fill="currentColor" /> HIRE
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {matched.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-md rounded-xl border border-lightning/40 bg-lightning/5 p-3 text-center"
          >
            <p className="text-sm font-semibold">
              Plan: Maestro will hire <span className="text-lightning">{matched.length}</span> specialists
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              executing in moments…
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="font-mono text-[10px] tracking-[0.15em] text-muted-foreground">{label}</h3>
      <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
    </div>
  );
}

function StatusPill({ status }: { status: "idle" | "planning" | "in_progress" | "complete" }) {
  const map = {
    idle: { label: "IDLE", cls: "border-border text-muted-foreground" },
    planning: { label: "PLANNING", cls: "border-lightning/50 text-lightning animate-pulse" },
    in_progress: { label: "IN PROGRESS", cls: "border-electric/50 text-electric animate-pulse" },
    complete: { label: "COMPLETE", cls: "border-success/50 text-success" },
  } as const;
  const m = map[status];
  return (
    <span className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-wider ${m.cls}`}>
      ● {m.label}
    </span>
  );
}

function ConsumerBadge({ kind }: { kind: "human" | "agent" }) {
  return kind === "human" ? (
    <span className="flex items-center gap-1.5 rounded-full border border-electric/40 bg-electric/10 px-3 py-1 font-mono text-[10px] text-electric">
      <User className="h-3 w-3" /> HUMAN CONSUMER
    </span>
  ) : (
    <span className="flex items-center gap-1.5 rounded-full border border-agent/40 bg-agent/10 px-3 py-1 font-mono text-[10px] text-agent">
      <Bot className="h-3 w-3" /> AGENT CONSUMER · MarketingBot
    </span>
  );
}

function AgentTypeBadge({ type }: { type: "ORCHESTRATOR" | "SPECIALIST" }) {
  if (type === "ORCHESTRATOR") {
    return (
      <span className="flex items-center gap-1 rounded-full border border-lightning/60 bg-lightning/15 px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-lightning">
        <Crown className="h-2.5 w-2.5" /> ORCHESTRATOR
      </span>
    );
  }
  return (
    <span className="rounded-full border border-electric/50 bg-electric/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.12em] text-electric">
      SPECIALIST
    </span>
  );
}

function StatusBadge({ status }: { status: Agent["status"] }) {
  const m = {
    idle: { label: "IDLE", cls: "text-muted-foreground border-border", icon: null },
    hired: { label: "HIRED", cls: "text-lightning border-lightning/50", icon: <Zap className="h-2.5 w-2.5" fill="currentColor" /> },
    working: { label: "WORKING", cls: "text-electric border-electric/50", icon: <Loader2 className="h-2.5 w-2.5 animate-spin" /> },
    done: { label: "DONE", cls: "text-success border-success/50", icon: <CheckCircle2 className="h-2.5 w-2.5" /> },
  } as const;
  const s = m[status];
  return (
    <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-wider ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

function AgentCard({
  agent, isMaestro, action, dimmed, highlighted,
}: {
  agent: Agent;
  isMaestro?: boolean;
  action?: string;
  dimmed: boolean;
  highlighted: boolean;
}) {
  const ringCls = isMaestro
    ? "border-lightning/50 shadow-lightning bg-surface"
    : highlighted
      ? "border-lightning/50 shadow-lightning bg-surface"
      : agent.status === "working"
        ? "border-electric/60 shadow-electric bg-surface"
        : agent.status === "done"
          ? "border-success/40 bg-surface"
          : "border-border bg-surface";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: dimmed ? 0.35 : 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${ringCls}`}
    >
      {isMaestro && (
        <div
          className="pointer-events-none absolute inset-0 opacity-20 gradient-lightning blur-3xl"
          style={{ height: "60%" }}
        />
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${
              isMaestro ? "gradient-lightning" : "bg-background border border-border"
            }`}>
              {agent.avatar}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{agent.name}</div>
              <div className="font-mono text-[9px] text-muted-foreground truncate">{agent.pubkey}</div>
            </div>
          </div>
          <AgentTypeBadge type={agent.agent_type} />
        </div>

        <div className="mt-3">
          <div className="text-xs text-foreground/90 leading-snug">{agent.capability}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {agent.capability_tags.slice(0, 5).map((t) => (
              <span
                key={t}
                className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {isMaestro && action && (
          <div className="mt-3 rounded-lg border border-border bg-background/60 p-2">
            <div className="flex items-center gap-1.5 font-mono text-[9px] tracking-wider text-muted-foreground">
              <Wand2 className="h-3 w-3 text-lightning" /> CURRENT ACTION
            </div>
            <motion.div key={action} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-0.5 text-xs">
              {action}
            </motion.div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">fee</span>
            <span className={`font-mono text-xs font-bold ${isMaestro ? "text-lightning" : "text-lightning"}`}>
              {agent.fee} sats
            </span>
          </div>
          {!isMaestro && <StatusBadge status={agent.status} />}
        </div>

        <div className="mt-2 flex items-center justify-between rounded-lg border border-border bg-background/50 px-2.5 py-1.5">
          <div className="flex items-center gap-1">
            <Zap className={`h-3 w-3 ${isMaestro ? "text-lightning" : "text-electric"}`} fill="currentColor" />
            <span className="font-mono text-[9px] tracking-wider text-muted-foreground">WALLET</span>
          </div>
          <div className={`font-mono text-sm font-bold ${isMaestro ? "text-lightning" : "text-electric"}`}>
            <AnimatedCounter value={agent.balance} /> <span className="text-[10px] text-muted-foreground">sats</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FinalOutput({
  ready, paid, onPay, onNext, jobStatus,
}: { ready: boolean; paid: boolean; onPay: () => void; onNext: () => void; jobStatus: string }) {
  return (
    <motion.div
      layout
      className="rounded-2xl border border-border bg-surface/60 p-5 shadow-elevated"
    >
      <SectionHeader label="FINAL OUTPUT" count={ready ? 1 : 0} />
      <AnimatePresence mode="wait">
        {!ready ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-background/40"
          >
            <p className="font-mono text-xs text-muted-foreground">
              {jobStatus === "in_progress" || jobStatus === "planning" ? "Rendering deliverable…" : "No output yet."}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]"
          >
            <div className="aspect-video overflow-hidden rounded-xl border border-electric/30 bg-black">
              <video
                src="https://cdn.coverr.co/videos/coverr-coffee-being-poured-into-a-cup-2649/1080p.mp4"
                controls
                autoPlay
                muted
                loop
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-border bg-background/50 p-4">
              <div>
                <div className="font-mono text-[10px] tracking-wider text-muted-foreground">DELIVERABLE</div>
                <div className="text-lg font-semibold">Ember Mug - Cinematic Cut</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">15s · 9:16 · MP4 · 4.2 MB</div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Tile k="SPENT" v="68" />
                  <Tile k="MARGIN" v="22" />
                  <Tile k="TOTAL" v="90" />
                </div>
              </div>
              {!paid ? (
                <button
                  onClick={onPay}
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl gradient-lightning px-5 py-3 font-bold text-primary-foreground shadow-lightning transition-transform hover:scale-[1.01]"
                >
                  <Zap className="h-4 w-4" fill="currentColor" /> Pay Maestro 90 sats
                </button>
              ) : (
                <button
                  onClick={onNext}
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-success/50 bg-success/10 px-5 py-3 font-semibold text-success"
                >
                  <CheckCircle2 className="h-4 w-4" /> Paid - start next job
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <div className="font-mono text-[9px] tracking-wider text-muted-foreground">{k}</div>
      <div className="font-mono text-base font-bold text-lightning">{v}</div>
    </div>
  );
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

/* ────────────── Add Agent Modal ────────────── */

const REQUIRED_FIELDS = ["id", "name", "agent_type", "capability", "capability_tags", "fee"] as const;

export function AddAgentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { upsertAgent, setCapabilityToast } = useMaestro();
  const [text, setText] = useState(JSON.stringify(TRANSLATION_AGENT_MANIFEST, null, 2));
  const [err, setErr] = useState<string | null>(null);

  // Reset to translation manifest each time modal opens
  useEffect(() => {
    if (open) {
      setText(JSON.stringify(TRANSLATION_AGENT_MANIFEST, null, 2));
      setErr(null);
    }
  }, [open]);

  const submit = async () => {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      setErr("Invalid JSON");
      return;
    }
    const missing = REQUIRED_FIELDS.filter((f) => parsed[f] === undefined || parsed[f] === null);
    if (missing.length) {
      setErr(`Missing required field(s): ${missing.join(", ")}`);
      return;
    }
    if (!Array.isArray(parsed.capability_tags) || parsed.capability_tags.length === 0) {
      setErr("capability_tags must be a non-empty array");
      return;
    }
    if (parsed.agent_type !== "SPECIALIST" && parsed.agent_type !== "ORCHESTRATOR") {
      setErr("agent_type must be SPECIALIST or ORCHESTRATOR");
      return;
    }

    // POST to /api/marketplace (best-effort; ignore failure for demo)
    try {
      const base = (import.meta as any).env?.VITE_BACKEND_URL ?? (import.meta as any).env?.NEXT_PUBLIC_BACKEND_URL;
      if (base) {
        await fetch(`${base}/api/marketplace`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed),
        }).catch(() => {});
      }
    } catch { /* noop */ }

    upsertAgent({
      id: String(parsed.id),
      name: String(parsed.name),
      agent_type: parsed.agent_type,
      capability: String(parsed.capability),
      capability_tags: parsed.capability_tags.map((t: any) => String(t)),
      specialty: String(parsed.capability),
      fee: Number(parsed.fee),
      balance: Number(parsed.balance ?? 100),
      status: "idle",
      avatar: String(parsed.avatar ?? "🤖"),
      color: "electric",
      pubkey: String(parsed.pubkey ?? "03????...????"),
    });

    // Capability detection toast
    const headlineTag = parsed.capability_tags[0];
    setCapabilityToast(`+ ${headlineTag} - Maestro can now route ${headlineTag} jobs to ${parsed.name}.`);
    onClose();
  };

  const loadTranslationDemo = () => {
    setText(JSON.stringify(TRANSLATION_AGENT_MANIFEST, null, 2));
    setErr(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-elevated"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-electric" />
                <h2 className="text-lg font-bold">Register agent</h2>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Paste a manifest (JSON). Required: <span className="font-mono text-foreground">id, name, agent_type, capability, capability_tags, fee</span>.
            </p>
            <button
              onClick={loadTranslationDemo}
              className="mb-3 rounded-md border border-electric/40 bg-electric/10 px-2.5 py-1 font-mono text-[10px] text-electric hover:bg-electric/20"
            >
              ↻ Load Translation Agent demo
            </button>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setErr(null); }}
              spellCheck={false}
              className="h-72 w-full rounded-lg border border-border bg-background p-3 font-mono text-xs outline-none focus:border-electric"
            />
            {err && <p className="mt-2 font-mono text-xs text-destructive">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button onClick={submit} className="rounded-lg gradient-electric px-4 py-2 text-sm font-bold text-accent-foreground shadow-electric">
                Add agent
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
