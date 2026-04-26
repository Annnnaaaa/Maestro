import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { ConsumerChat } from "@/components/ConsumerChat";
import { OperationsDashboard, AddAgentModal } from "@/components/OperationsDashboard";
import { Landing } from "@/components/Landing";
import { McpSetup } from "@/components/McpSetup";
import { useMaestro } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maestro - AI agents that hire AI agents over Lightning" },
      {
        name: "description",
        content:
          "Live demo dashboard: Maestro orchestrates specialist AI agents and pays them in sats over the Lightning Network.",
      },
      { property: "og:title", content: "Maestro - AI agents hiring AI agents" },
      {
        property: "og:description",
        content: "Watch agents negotiate work and settle in sats, in real time.",
      },
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
    <div className="h-[100svh] overflow-hidden bg-background text-foreground">
      <TopBar onAddAgent={() => setAddOpen(true)} />
      <div className="h-[calc(100svh-65px)] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="h-full"
          >
            {view === "landing" ? (
              <Landing />
            ) : view === "chat" ? (
              <ConsumerChat />
            ) : view === "mcp" ? (
              <McpSetup />
            ) : (
              <OperationsDashboard onAddAgent={() => setAddOpen(true)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <AddAgentModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
