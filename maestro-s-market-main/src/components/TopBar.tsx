import { useMaestro } from "@/lib/store";
import { AnimatedCounter } from "./AnimatedCounter";
import { Plus, Zap } from "lucide-react";
import { useState } from "react";

export function TopBar({ onAddAgent }: { onAddAgent: () => void }) {
  const { view, setView, gmv, jobsCompleted, agents } = useMaestro();

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-lightning shadow-lightning">
            <Zap className="h-5 w-5 text-primary-foreground" fill="currentColor" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold tracking-tight">MAESTRO</div>
            <div className="font-mono text-[10px] text-muted-foreground">agent · hires · agents</div>
          </div>
        </div>

        <nav className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
          {(["chat", "ops"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                view === v
                  ? "bg-surface-elevated text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "chat" ? "Consumer Chat" : "Operations"}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Stat label="GMV TODAY" value={<><AnimatedCounter value={gmv} /> <span className="text-lightning">sats</span></>} />
          <Stat label="JOBS DONE" value={<AnimatedCounter value={jobsCompleted} />} />
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">AGENTS</span>
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
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-bold">{value}</span>
    </div>
  );
}

export function useAddAgentModal() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
