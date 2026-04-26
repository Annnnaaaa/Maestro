import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { ConsumerChat } from "@/components/ConsumerChat";
import { OperationsDashboard, AddAgentModal } from "@/components/OperationsDashboard";
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
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar onAddAgent={() => setAddOpen(true)} />
      {view === "chat" ? <ConsumerChat /> : <OperationsDashboard onAddAgent={() => setAddOpen(true)} />}
      <AddAgentModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
