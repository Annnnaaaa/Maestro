import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMaestro } from "@/lib/store";
import { CHAT_SCRIPT } from "@/lib/maestro-mock";
import type { ChatMessage } from "@/lib/types";
import { Send, Sparkles, Zap } from "lucide-react";

export function ConsumerChat() {
  const { spec, addSpec, resetSpec, startJob, setView } = useMaestro();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "intro", role: "maestro", content: "Hey, I'm Maestro. Tell me what you need built and I'll hire the right agents to make it happen." },
  ]);
  const [step, setStep] = useState(0);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resetSpec();
    // first prompt from user simulated by placeholder
  }, [resetSpec]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = () => {
    if (!input.trim() && step > 0) return;
    const userText = step === 0 ? (input.trim() || "I need a product video for my coffee mug.") : input.trim();
    if (!userText) return;

    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: userText }]);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      const next = CHAT_SCRIPT[step];
      if (next) {
        setMessages((m) => [...m, { id: crypto.randomUUID(), role: "maestro", content: next.maestro }]);
        if (next.spec) addSpec(next.spec);
      }
      setThinking(false);
      setStep((s) => s + 1);
    }, 700);
  };

  const ready = step > CHAT_SCRIPT.length;
  const currentPrompt = CHAT_SCRIPT[step]?.userPrompt ?? "Tell Maestro what you need…";
  const suggested = step > 0 && step <= CHAT_SCRIPT.length ? CHAT_SCRIPT[step - 1].userReply : "I need a product video for my coffee mug.";

  return (
    <div className="grid-bg min-h-[calc(100svh-65px)]">
      <div className="mx-auto grid max-w-[1400px] gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_380px]">
        {/* CHAT */}
        <div className="flex h-[calc(100svh-130px)] min-h-[480px] flex-col rounded-2xl border border-border bg-surface/60 shadow-elevated backdrop-blur lg:h-[calc(100svh-130px)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md gradient-lightning">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-none">Maestro</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground leading-none">orchestrator · online</div>
              </div>
            </div>
            <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground">end-to-end · sub-second settlement</span>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-electric/15 text-foreground border border-electric/30"
                        : "rounded-bl-sm bg-surface-elevated border border-border"
                    }`}
                  >
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {thinking && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="flex gap-1 rounded-2xl rounded-bl-sm border border-border bg-surface-elevated px-4 py-3">
                    {[0, 0.2, 0.4].map((d) => (
                      <motion.span
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: d }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="border-t border-border p-4">
            {ready ? (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  startJob("Coffee Mug Product Video", "human");
                  setView("ops");
                }}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl gradient-lightning px-6 py-3.5 text-base font-bold text-primary-foreground shadow-lightning transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <Zap className="h-5 w-5" fill="currentColor" />
                Hire Maestro - 90 sats
                <motion.span
                  className="absolute inset-0 -translate-x-full bg-white/20"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  style={{ width: "30%" }}
                />
              </motion.button>
            ) : (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={currentPrompt}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-electric"
                  />
                  <button
                    onClick={() => setInput(suggested)}
                    className="mt-1.5 font-mono text-[10px] text-muted-foreground hover:text-electric"
                  >
                    suggest: "{suggested}"
                  </button>
                </div>
                <button
                  onClick={send}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric/15 text-electric transition-colors hover:bg-electric/25"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SPEC PANEL */}
        <div className="rounded-2xl border border-border bg-surface/60 p-5 shadow-elevated backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-mono text-xs tracking-wider text-muted-foreground">JOB SPEC</h3>
            <span className="font-mono text-[10px] text-muted-foreground">
              {spec.length}/{CHAT_SCRIPT.length} fields
            </span>
          </div>
          {spec.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <div className="mb-2 text-3xl opacity-40">📋</div>
              <p className="text-xs text-muted-foreground">Spec fields will appear as you chat.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence>
                {spec.map((f) => (
                  <motion.li
                    key={f.key}
                    initial={{ opacity: 0, x: 16, backgroundColor: "rgba(0,217,255,0.25)" }}
                    animate={{ opacity: 1, x: 0, backgroundColor: "rgba(0,217,255,0)" }}
                    transition={{ duration: 0.7 }}
                    className="rounded-lg border border-border bg-background/60 p-3"
                  >
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {f.key}
                    </div>
                    <div className="text-sm font-medium">{f.value}</div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}

          <div className="mt-6 rounded-lg border border-border bg-background/40 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground">ESTIMATED COST</span>
              <Zap className="h-3 w-3 text-lightning" fill="currentColor" />
            </div>
            <div className="font-mono text-2xl font-bold text-lightning">
              {ready ? "90" : Math.min(spec.length * 18, 90)} <span className="text-xs text-muted-foreground">sats</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              ≈ ${((ready ? 90 : Math.min(spec.length * 18, 90)) * 0.0006).toFixed(3)} USD
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
