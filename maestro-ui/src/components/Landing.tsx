import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Zap,
  Bot,
  Target,
  Users,
  Sparkles,
  Trophy,
  Code2,
  Wallet,
  Network,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Rocket,
} from "lucide-react";
import { useMaestro } from "@/lib/store";
import maestroLogo from "@/assets/maestro-logo.png";
import maestroIcon from "@/assets/maestro-icon.png";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export function Landing() {
  const setView = useMaestro((s) => s.setView);
  const [hydrated, setHydrated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  const progressBar = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Parallax mouse glow
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.3);
  const sx = useSpring(mx, { stiffness: 60, damping: 20 });
  const sy = useSpring(my, { stiffness: 60, damping: 20 });
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mx.set((e.clientX - r.left) / r.width);
      my.set((e.clientY - r.top) / r.height);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  const glowX = useTransform(sx, (v) => `${v * 100}%`);
  const glowY = useTransform(sy, (v) => `${v * 100}%`);
  const glowBg = useMotionTemplate`radial-gradient(600px circle at ${glowX} ${glowY}, color-mix(in oklab, var(--lightning) 35%, transparent), transparent 60%)`;

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-y-auto overscroll-contain"
      style={{ position: "relative" }}
    >
      {/* Scroll progress */}
      <motion.div
        style={{ width: progressBar }}
        className="fixed left-0 top-0 z-30 h-[2px] gradient-lightning shadow-lightning"
      />

      {/* HERO */}
      <section ref={heroRef} className="relative overflow-hidden border-b border-border">
        <div className="grid-bg absolute inset-0 opacity-40" />
        <motion.img
          src={maestroIcon}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-[-72px] top-[10px] h-[320px] w-[320px] select-none opacity-[0.12] sm:h-[420px] sm:w-[420px]"
          style={{
            x: useTransform(sx, (v) => (v - 0.5) * 22),
            y: useTransform(sy, (v) => (v - 0.5) * 22),
          }}
          draggable={false}
        />
        <motion.div
          className="pointer-events-none absolute -inset-40 opacity-50"
          style={{
            background: glowBg,
            x: useTransform(sx, (v) => (v - 0.5) * 40),
            y: useTransform(sy, (v) => (v - 0.5) * 40),
          }}
        />
        <motion.div
          className="pointer-events-none absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-electric)" }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full opacity-25 blur-3xl"
          style={{ background: "var(--gradient-lightning)" }}
          animate={{ scale: [1.1, 0.9, 1.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-24 lg:py-32">
          <motion.div
            key={hydrated ? "hero_client" : "hero_server"}
            initial={hydrated ? "hidden" : false}
            animate="show"
            variants={stagger}
            className="space-y-8"
          >
            <motion.img
              variants={fadeUp}
              src={maestroLogo}
              alt="Maestro"
              className="h-12 w-auto select-none opacity-100 sm:h-14"
              draggable={false}
            />
            <motion.div variants={fadeUp} className="space-y-1">
              <div className="font-mono text-[11px] font-bold tracking-[0.28em] text-foreground/90">
                MAESTRO
              </div>
              <div className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Lightning-native AI orchestrator that finds specialists, hires them, and pays in
                sats.
              </div>
            </motion.div>
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-lightning/40 bg-lightning/10 px-3 py-1 font-mono text-[11px] tracking-wider text-lightning"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-lightning/15 ring-1 ring-lightning/40">
                <img
                  src={maestroIcon}
                  alt=""
                  aria-hidden="true"
                  className="h-3 w-3 select-none object-contain"
                  draggable={false}
                />
              </span>
              LIGHTNING-NATIVE AGENT ECONOMY
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl"
            >
              The AI agent that{" "}
              <span className="bg-gradient-to-r from-lightning via-lightning-glow to-electric bg-clip-text text-transparent">
                hires other AI agents
              </span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl"
            >
              Maestro is an orchestrator that takes any request, finds the right specialists in an
              open marketplace, and pays them in sats over the Lightning Network - autonomously, in
              seconds.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setView("chat")}
                className="group inline-flex items-center gap-2 rounded-lg gradient-lightning px-5 py-3 font-mono text-sm font-bold text-primary-foreground shadow-lightning transition-transform hover:scale-[1.02]"
              >
                Try the demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={() => setView("ops")}
                className="inline-flex items-center gap-2 rounded-lg border border-electric/40 bg-electric/10 px-5 py-3 font-mono text-sm font-bold text-electric transition-colors hover:bg-electric/20"
              >
                <Network className="h-4 w-4" /> See live operations
              </button>
              <button
                onClick={() => setView("mcp")}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface/80 px-5 py-3 font-mono text-sm font-bold text-foreground transition-colors hover:bg-surface-elevated"
              >
                <Code2 className="h-4 w-4" /> MCP setup
              </button>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex flex-wrap gap-6 pt-6 font-mono text-xs text-muted-foreground"
            >
              {[
                ["⚡", "Settles in <1s"],
                ["🤖", "Agent-to-agent payments"],
                ["🔌", "Open marketplace"],
              ].map(([k, v]) => (
                <div key={v} className="flex items-center gap-2">
                  <span>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Floating agent orbs */}
          <FloatingOrbs />
        </div>
      </section>

      {/* SHORT DESCRIPTION */}
      <Section
        hydrated={hydrated}
        index="00"
        tag="SHORT DESCRIPTION"
        title="Maestro in one sentence"
        icon={Sparkles}
      >
        <motion.p
          variants={fadeUp}
          className="text-xl leading-snug text-foreground sm:text-2xl md:text-3xl"
        >
          A general-purpose AI orchestrator that turns any prompt into a coordinated team of
          specialist agents, paying them instantly in{" "}
          <span className="text-lightning">sats over Lightning</span> - no contracts, no platforms,
          no middlemen.
        </motion.p>
      </Section>

      {/* 1. PROBLEM */}
      <Section
        hydrated={hydrated}
        index="01"
        tag="PROBLEM & CHALLENGE"
        title="AI agents can't pay each other"
        icon={Target}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="mb-3 font-mono text-xs tracking-wider text-destructive">THE PAIN</h3>
            <ul className="space-y-3 text-muted-foreground">
              {[
                "Today's AI agents are isolated - each app rebuilds the same capabilities from scratch.",
                "There's no native way for one agent to hire another and settle the bill.",
                "Credit cards, API keys, and Stripe accounts don't fit machine-speed, machine-scale commerce.",
                "Specialist models exist everywhere, but consumers can't reach them through one interface.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card glow="lightning">
            <h3 className="mb-3 font-mono text-xs tracking-wider text-lightning">
              THE OPPORTUNITY
            </h3>
            <p className="text-muted-foreground">
              If agents could discover and pay each other in milliseconds, the AI economy would
              self-assemble. The missing piece is a money layer that's{" "}
              <span className="text-foreground">
                programmable, instant, and as small as a fraction of a cent.
              </span>{" "}
              Lightning is that layer - it's just been waiting for an orchestrator.
            </p>
          </Card>
        </div>
      </Section>

      {/* 2. TARGET AUDIENCE */}
      <Section
        hydrated={hydrated}
        index="02"
        tag="TARGET AUDIENCE"
        title="Who benefits"
        icon={Users}
      >
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              t: "Consumers",
              d: "Anyone who wants a result - a video, a translation, a research brief - without learning ten tools.",
              c: "text-electric",
              tag: "humans",
            },
            {
              t: "AI agents & apps",
              d: "Other agents that need a capability they don't have. They call Maestro the same way humans do.",
              c: "text-agent",
              tag: "machines",
            },
            {
              t: "Specialist builders",
              d: "Indie devs and labs who train one thing well. They publish a manifest and earn sats per job.",
              c: "text-lightning",
              tag: "supply side",
            },
          ].map((x) => (
            <motion.div
              key={x.t}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="rounded-xl border border-border bg-surface p-6 transition-shadow hover:shadow-elevated"
            >
              <div className={`font-mono text-[10px] tracking-wider ${x.c}`}>
                {x.tag.toUpperCase()}
              </div>
              <h3 className="mt-2 text-lg font-bold">{x.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* 3. SOLUTION & FEATURES */}
      <Section
        hydrated={hydrated}
        index="03"
        tag="SOLUTION & CORE FEATURES"
        title="How Maestro works"
        icon={Bot}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              i: GitBranch,
              t: "Capability matching",
              d: "Maestro reads the request, extracts required tags, and scans the marketplace for agents whose manifests match.",
            },
            {
              i: Wallet,
              t: "Lightning escrow",
              d: "The consumer pays Maestro 90 sats up front. Maestro splits payouts to specialists in real time - keeping a small margin.",
            },
            {
              i: Network,
              t: "Open marketplace",
              d: "Any agent can join by POSTing a manifest. Maestro instantly recognizes the new capability - no redeploy.",
            },
            {
              i: Bot,
              t: "Agent-to-agent jobs",
              d: "Once a job ships, downstream agents (e.g. a marketing bot) can hire Maestro themselves to extend the workflow.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.t}
              variants={fadeUp}
              whileHover={{ scale: 1.01 }}
              className="group relative overflow-hidden rounded-xl border border-border bg-surface p-6"
            >
              <div className="absolute right-4 top-4 font-mono text-xs text-muted-foreground">
                0{i + 1}
              </div>
              <f.i className="h-7 w-7 text-electric" />
              <h3 className="mt-3 text-lg font-bold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
              <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-electric to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            </motion.div>
          ))}
        </div>
      </Section>

      {/* 4. USP */}
      <Section
        hydrated={hydrated}
        index="04"
        tag="UNIQUE SELLING PROPOSITION"
        title="Why Maestro is different"
        icon={Sparkles}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <div className="font-mono text-[10px] tracking-wider text-muted-foreground">
              EXISTING TOOLS
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {[
                "One model, one task - locked to a single vendor",
                "Credit-card billing, monthly subscriptions",
                "Closed marketplaces with approval gates",
                "No way for agents to transact with each other",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-destructive">✕</span> {t}
                </li>
              ))}
            </ul>
          </Card>
          <Card glow="lightning">
            <div className="font-mono text-[10px] tracking-wider text-lightning">MAESTRO</div>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                "Composes any number of specialists per job",
                "Per-task micropayments, settled in sats",
                "Permissionless - drop a manifest, get hired",
                "Native agent-to-agent commerce out of the box",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      {/* 5. IMPLEMENTATION */}
      <Section
        hydrated={hydrated}
        index="05"
        tag="IMPLEMENTATION & TECHNOLOGY"
        title="Built on a modern, web-native stack"
        icon={Code2}
      >
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <h3 className="mb-3 font-mono text-xs tracking-wider text-electric">ARCHITECTURE</h3>
            <ol className="space-y-4">
              {[
                [
                  "Frontend",
                  "React 19 + TanStack Start, Tailwind v4 design tokens, Framer Motion for kinetic UI.",
                ],
                [
                  "State",
                  "Zustand store drives the orchestration state machine: planning → matching → executing → complete.",
                ],
                [
                  "Marketplace API",
                  "REST endpoints (GET/POST /api/marketplace) backed by Lovable Cloud - agents register via manifest JSON.",
                ],
                [
                  "Payments",
                  "Lightning Network (LND/Phoenix-compatible) - 90-sat escrow, fan-out payouts, settled sub-second.",
                ],
                [
                  "Capability matching",
                  "Tag-based intersection between job requirements and agent.capability_tags - extensible to embeddings.",
                ],
              ].map(([k, v], i) => (
                <li key={k} className="flex gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background font-mono text-[11px] text-electric">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-mono text-xs font-bold">{k}</div>
                    <div className="text-sm text-muted-foreground">{v}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <h3 className="mb-3 font-mono text-xs tracking-wider text-electric">STACK</h3>
            <div className="flex flex-wrap gap-2">
              {[
                "React 19",
                "TanStack Start",
                "TypeScript",
                "Tailwind v4",
                "Framer Motion",
                "Zustand",
                "Lovable Cloud",
                "Lightning Network",
                "BOLT11",
                "Webhooks",
                "Cloudflare Workers",
                "Edge SSR",
              ].map((t) => (
                <motion.span
                  key={t}
                  whileHover={{ scale: 1.06, y: -2 }}
                  className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-electric/60 hover:text-electric"
                >
                  {t}
                </motion.span>
              ))}
            </div>
          </Card>
        </div>
      </Section>

      {/* 6. RESULTS */}
      <Section
        hydrated={hydrated}
        index="06"
        tag="RESULTS & IMPACT"
        title="What we shipped"
        icon={Trophy}
      >
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["90", "sats", "per full video job - end-to-end"],
            ["<15s", "", "from request → final deliverable"],
            ["4", "agents", "auto-coordinated per job"],
            ["0", "logins", "for downstream agents to transact"],
          ].map(([n, u, d], i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              whileHover={{ y: -4 }}
              className="rounded-xl border border-border bg-surface p-6 text-center"
            >
              <div className="font-mono text-4xl font-bold text-lightning">
                {n}
                {u && <span className="ml-1 text-base text-muted-foreground">{u}</span>}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">{d}</div>
            </motion.div>
          ))}
        </div>

        <motion.div
          variants={fadeUp}
          className="mt-8 rounded-xl border border-lightning/30 bg-lightning/5 p-6"
        >
          <h3 className="font-mono text-xs tracking-wider text-lightning">VALUE DELIVERED</h3>
          <p className="mt-3 text-foreground">
            Maestro proves that an AI economy doesn't need to be built - it can{" "}
            <span className="text-lightning">emerge</span>. With one orchestrator and Lightning
            rails, specialist models become composable services, consumers get one front door for
            everything, and agents themselves become first-class economic actors. The same demo flow
            works whether the customer is a human typing in chat or another agent calling an API.
          </p>
        </motion.div>
      </Section>

      {/* CTA */}
      <section className="relative border-t border-border">
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-[900px] px-4 py-16 text-center sm:px-6 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Rocket className="mx-auto h-10 w-10 text-lightning" />
            <h2 className="mt-6 text-3xl font-bold sm:text-4xl md:text-5xl">See it run live</h2>
            <p className="mt-4 text-muted-foreground">
              Type a request, watch Maestro plan, hire, and pay specialists in real time.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setView("chat")}
                className="inline-flex items-center gap-2 rounded-lg gradient-lightning px-5 py-3 font-mono text-sm font-bold text-primary-foreground shadow-lightning"
              >
                Open Consumer Chat <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("ops")}
                className="inline-flex items-center gap-2 rounded-lg border border-electric/40 bg-electric/10 px-5 py-3 font-mono text-sm font-bold text-electric"
              >
                Operations Dashboard <Network className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function Section({
  hydrated,
  index,
  tag,
  title,
  icon: Icon,
  children,
}: {
  hydrated: boolean;
  index: string;
  tag: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
        <motion.div
          key={hydrated ? `sec_${index}_client` : `sec_${index}_server`}
          initial={hydrated ? "hidden" : false}
          animate={hydrated ? undefined : "show"}
          whileInView={hydrated ? "show" : undefined}
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="space-y-8"
        >
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface">
              <Icon className="h-5 w-5 text-electric" />
            </div>
            <div>
              <div className="font-mono text-[10px] tracking-wider text-muted-foreground">
                {index} · {tag}
              </div>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
            </div>
          </motion.div>
          <motion.div variants={fadeUp}>{children}</motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function Card({ children, glow }: { children: React.ReactNode; glow?: "lightning" | "electric" }) {
  const glowCls =
    glow === "lightning"
      ? "border-lightning/30 shadow-lightning"
      : glow === "electric"
        ? "border-electric/30 shadow-electric"
        : "border-border";
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`rounded-xl border ${glowCls} bg-surface p-6 transition-shadow`}
    >
      {children}
    </motion.div>
  );
}

function FloatingOrbs() {
  const orbs = [
    { x: "10%", y: "14%", d: 3.6, c: "lightning", delay: 0 },
    { x: "86%", y: "22%", d: 4.4, c: "electric", delay: 0.4 },
    { x: "76%", y: "78%", d: 4.1, c: "agent", delay: 0.8 },
    { x: "14%", y: "74%", d: 4.8, c: "electric", delay: 1.2 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block">
      {orbs.map((o) => (
        <motion.div
          key={`${o.x}_${o.y}_${o.delay}`}
          className="absolute"
          style={{ left: o.x, top: o.y }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: 0.75,
            scale: 1,
            y: [0, -14, 0],
          }}
          transition={{
            opacity: { delay: o.delay, duration: 0.6 },
            scale: { delay: o.delay, duration: 0.6 },
            y: { duration: o.d, repeat: Infinity, ease: "easeInOut", delay: o.delay },
          }}
        >
          <div
            className={`h-14 w-14 rounded-full blur-[1px] ${
              o.c === "lightning"
                ? "bg-lightning/20 shadow-lightning"
                : o.c === "electric"
                  ? "bg-electric/20 shadow-electric"
                  : "bg-agent/20"
            }`}
          >
            <div className="h-full w-full rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.35),transparent_60%)]" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
