import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { ConsumerChat } from "@/components/ConsumerChat";
import { OperationsDashboard, AddAgentModal } from "@/components/OperationsDashboard";
import { Landing } from "@/components/Landing";
import { useMaestro } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maestro — AI agents that hire AI agents over Lightning" },
      { name: "description", content: "Live demo dashboard: Maestro orchestrates specialist AI agents and pays them in sats over the Lightning Network." },
      { property: "og:title", content: "Maestro — AI agents hiring AI agents" },
      { property: "og:description", content: "Watch agents negotiate work and settle in sats, in real time." },
    ],
  }),
  component: Index,
});

function Index() {
  const view = useMaestro((s) => s.view);
  const init = useMaestro((s) => s.initFromBackend);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar onAddAgent={() => setAddOpen(true)} />
      {view === "landing" ? (
        <Landing />
      ) : view === "chat" ? (
        <ConsumerChat />
      ) : (
        <OperationsDashboard onAddAgent={() => setAddOpen(true)} />
      )}
      <AddAgentModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
