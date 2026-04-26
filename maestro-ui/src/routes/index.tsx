import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { ConsumerChat } from "@/components/ConsumerChat";
import { OperationsDashboard, AddAgentModal } from "@/components/OperationsDashboard";
import { Landing } from "@/components/Landing";
import { useMaestro } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maestro - AI agents that hire AI agents over Lightning" },
      { name: "description", content: "Live demo dashboard: Maestro orchestrates specialist AI agents and pays them in sats over the Lightning Network." },
      { property: "og:title", content: "Maestro - AI agents hiring AI agents" },
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
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {view === "landing" ? (
            <Landing />
          ) : view === "chat" ? (
            <ConsumerChat />
          ) : (
            <OperationsDashboard onAddAgent={() => setAddOpen(true)} />
          )}
        </motion.div>
      </AnimatePresence>
      <AddAgentModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
