import { useMaestro } from "@/lib/store";
import { AnimatedCounter } from "./AnimatedCounter";
import { Plus, Zap, Menu, X } from "lucide-react";
import { useState } from "react";
import maestroIcon from "@/assets/maestro-icon.png";

export function TopBar({ onAddAgent }: { onAddAgent: () => void }) {
  const { view, setView, gmv, jobsCompleted, agents } = useMaestro();
  const [mobileOpen, setMobileOpen] = useState(false);

  const tabs = [
    { id: "landing" as const, label: "Overview" },
    { id: "chat" as const, label: "Consumer Chat" },
    { id: "ops" as const, label: "Operations" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Brand */}
        <button
          onClick={() => setView("landing")}
          className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-lightning shadow-lightning">
            <img
              src={maestroIcon}
              alt="Maestro"
              className="h-7 w-7 select-none object-contain"
              draggable={false}
            />
          </div>
          <div className="hidden sm:block text-left">
            <div className="font-mono text-sm font-bold tracking-tight leading-none">MAESTRO</div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground leading-none">
              orchestration · lightning
            </div>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 rounded-lg border border-border bg-surface/80 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all lg:px-4 ${
                view === t.id
                  ? "bg-surface-elevated text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Desktop stats */}
        <div className="hidden lg:flex items-center gap-3">
          <Stat
            label="GMV TODAY"
            value={
              <>
                <AnimatedCounter value={gmv} /> <span className="text-lightning">sats</span>
              </>
            }
          />
          <Stat label="JOBS" value={<AnimatedCounter value={jobsCompleted} />} />
          <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/80 px-3 py-1.5">
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
              AGENTS
            </span>
            <span className="font-mono text-sm font-bold text-electric">{agents.length}</span>
            <button
              onClick={onAddAgent}
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-md bg-electric/15 text-electric transition-colors hover:bg-electric/25"
              aria-label="Add agent"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tablet - compact stats only */}
        <div className="hidden md:flex lg:hidden items-center gap-2">
          <span className="rounded-md border border-border bg-surface/80 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            <span className="text-lightning font-bold">
              <AnimatedCounter value={gmv} />
            </span>{" "}
            sats
          </span>
          <button
            onClick={onAddAgent}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-electric/40 bg-electric/10 text-electric"
            aria-label="Add agent"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface/80 text-foreground"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-3">
            <nav className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setView(t.id);
                    setMobileOpen(false);
                  }}
                  className={`rounded-md px-2 py-2 text-xs font-medium transition-all ${
                    view === t.id ? "bg-surface-elevated text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="grid grid-cols-3 gap-2">
              <MobileStat
                label="GMV"
                value={
                  <>
                    <AnimatedCounter value={gmv} />
                    <span className="text-lightning"> sats</span>
                  </>
                }
              />
              <MobileStat label="JOBS" value={<AnimatedCounter value={jobsCompleted} />} />
              <MobileStat
                label="AGENTS"
                value={<span className="text-electric">{agents.length}</span>}
              />
            </div>
            <button
              onClick={() => {
                onAddAgent();
                setMobileOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-electric/40 bg-electric/10 px-3 py-2 text-sm font-semibold text-electric"
            >
              <Plus className="h-4 w-4" /> Add agent
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="font-mono text-[10px] tracking-wider text-muted-foreground">{label}</span>
      <span className="mt-1 font-mono text-sm font-bold">{value}</span>
    </div>
  );
}

function MobileStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-2">
      <div className="font-mono text-[9px] tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-bold">{value}</div>
    </div>
  );
}
