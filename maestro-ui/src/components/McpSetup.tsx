import { useMemo } from "react";
import { useMaestro } from "@/lib/store";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-surface/70 p-4 text-xs text-foreground">
      <code>{children}</code>
    </pre>
  );
}

export function McpSetup() {
  const setView = useMaestro((s) => s.setView);

  const jsonConfig = useMemo(
    () =>
      `{
  "mcpServers": {
    "maestro": {
      "command": "node",
      "args": ["<ABS_PATH>/Maestro/mcp-server/dist/index.js"],
      "env": {
        "MAESTRO_API_URL": "http://localhost:3000"
      }
    }
  }
}`,
    []
  );

  const httpPayload = useMemo(
    () =>
      `// Request (Maestro -> MCP context service)
{
  "request": "Create a product video for Maestro",
  "missing_inputs": ["product_description", "target_audience"],
  "consumer_inputs": { "product_name": "Maestro" }
}

// Response
{
  "filled_inputs": {
    "product_description": "A lightning-native agent marketplace that lets people hire specialist agents and pay in sats.",
    "target_audience": "builders and early adopters of AI + Lightning"
  },
  "notes": "Derived from repo README + product docs"
}`,
    []
  );

  return (
    <div className="grid-bg h-[calc(100svh-65px)] overflow-hidden">
      <div className="mx-auto h-full max-w-[1200px] overflow-y-auto px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] font-bold tracking-[0.28em] text-muted-foreground">
              MCP SETUP
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Connect Maestro via MCP</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Use the local stdio MCP server to expose Maestro as tools to MCP-compatible clients (Cursor,
              Claude MCP, etc.). Optionally, configure an MCP-backed HTTP context service so Maestro can
              auto-fill missing inputs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://maestro-amber-omega.vercel.app/"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-border bg-surface/80 px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elevated"
            >
              Open published docs
            </a>
            <button
              onClick={() => setView("chat")}
              className="rounded-lg gradient-lightning px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lightning"
            >
              Back to chat
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-surface/60 p-6 shadow-elevated backdrop-blur">
            <h2 className="text-lg font-semibold">1) Build the MCP server</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Run this from the repo root. The server is stdio (spawned locally).
            </p>
            <CodeBlock>{`cd mcp-server
npm install
npm run build`}</CodeBlock>
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-6 shadow-elevated backdrop-blur">
            <h2 className="text-lg font-semibold">2) Configure your MCP client</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add a server entry that runs <span className="font-mono">node</span> with the built script and
              sets <span className="font-mono">MAESTRO_API_URL</span>.
            </p>
            <CodeBlock>{jsonConfig}</CodeBlock>
          </section>

          <section className="rounded-2xl border border-border bg-surface/60 p-6 shadow-elevated backdrop-blur lg:col-span-2">
            <h2 className="text-lg font-semibold">Optional: MCP context enrichment (HTTP)</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              If a job is missing required inputs, Maestro can call an external HTTP endpoint to fill them
              before asking the user. Configure these env vars on the Maestro backend:
            </p>
            <CodeBlock>{`MAESTRO_MCP_CONTEXT_URL=http://<your-service>/context
MAESTRO_MCP_TIMEOUT_MS=2500`}</CodeBlock>
            <p className="mt-3 text-sm text-muted-foreground">
              The endpoint should accept and return JSON in this shape:
            </p>
            <CodeBlock>{httpPayload}</CodeBlock>
          </section>
        </div>
      </div>
    </div>
  );
}

