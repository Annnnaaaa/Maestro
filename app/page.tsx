export default function Home() {
  const dashboard = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "(not configured)";
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>Maestro</h1>
      <p style={{ marginTop: 8, maxWidth: 820 }}>
        Maestro is an <strong>orchestrator agent</strong> that turns a high-level request into a paid,
        multi-step pipeline. It inspects a marketplace of specialist agents, plans which ones to run
        (including LLM-based selection when there are multiple candidates), pays each step via the{" "}
        <strong>Lightning Network</strong>, and aggregates the outputs.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, minWidth: 260 }}>
          <div style={{ fontWeight: 600 }}>Marketplace specialists (default demo)</div>
          <ul style={{ margin: "8px 0 0 18px" }}>
            <li>
              <code>script-agent-v1</code> — <code>video_script_writing</code>
            </li>
            <li>
              <code>voice-agent-v1</code> — <code>voiceover_generation</code>
            </li>
            <li>
              <code>visual-agent-v1</code> — <code>video_visual_generation</code>
            </li>
            <li>
              <code>magichour-video-agent</code> — <code>product_video_generation</code>
            </li>
          </ul>
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, minWidth: 260 }}>
          <div style={{ fontWeight: 600 }}>Dashboard</div>
          <div style={{ marginTop: 8 }}>
            <code>{dashboard}</code>
          </div>
          <div style={{ marginTop: 8, fontSize: 13, color: "#374151", maxWidth: 360 }}>
            Set <code>NEXT_PUBLIC_DASHBOARD_URL</code> to show the external UI that drives the demo.
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: 20 }}>How the flow works</h2>
      <ol style={{ maxWidth: 920 }}>
        <li>
          <strong>Plan + price</strong>: <code>POST /api/maestro/job</code> → returns a plan, pricing,
          and a Lightning invoice.
        </li>
        <li>
          <strong>Pay</strong>: settle the invoice (demo shortcut available via{" "}
          <code>POST /api/maestro/job/&lt;jobId&gt;/mark-paid</code>).
        </li>
        <li>
          <strong>Execute</strong>: <code>POST /api/maestro/job/&lt;jobId&gt;/execute</code> → streams
          Server-Sent Events with progress and final outputs.
        </li>
      </ol>

      <h2 style={{ marginTop: 20 }}>Core endpoints</h2>
      <ul style={{ lineHeight: 1.7 }}>
        <li>
          <code>GET /api/agent/manifest</code> — Maestro’s own manifest (orchestrator)
        </li>
        <li>
          <code>GET /api/marketplace</code> — list currently known agents (manifests)
        </li>
        <li>
          <code>POST /api/marketplace</code> — register an agent (full <code>AgentManifest</code>)
        </li>
        <li>
          <code>POST /api/maestro/intake</code> — optional LLM parsing to extract structured inputs
          from a free-form prompt
        </li>
        <li>
          <code>POST /api/maestro/job</code> — create a job (plan + invoice)
        </li>
        <li>
          <code>POST /api/maestro/job/&lt;jobId&gt;/execute</code> — payment-gated execution (SSE)
        </li>
        <li>
          <code>POST /api/lightning/verify</code> — verify a payment hash (used by sub-agents)
        </li>
      </ul>

      <h2 style={{ marginTop: 20 }}>Quickstart (curl)</h2>
      <pre
        style={{
          background: "#0b1020",
          color: "#e5e7eb",
          padding: 12,
          borderRadius: 12,
          overflowX: "auto",
          maxWidth: 980,
        }}
      >{`# 1) Plan + invoice
curl -s http://localhost:3000/api/maestro/job \\
  -H "Content-Type: application/json" \\
  -d '{
    "request": "Make a short product video for GlowBottle",
    "inputs": {
      "product_name": "GlowBottle",
      "product_description": "A self-cleaning water bottle.",
      "target_audience": "busy commuters",
      "visual_context": "clean, minimal, bright studio lighting",
      "voiceover_tone": "warm and playful",
      "duration_seconds": 15
    }
  }'

# 2) Demo-only: mark invoice paid (skip real Lightning settlement)
curl -s -X POST http://localhost:3000/api/maestro/job/<jobId>/mark-paid

# 3) Execute (SSE stream)
curl -N -s -X POST http://localhost:3000/api/maestro/job/<jobId>/execute`}</pre>

      <h2 style={{ marginTop: 20 }}>MCP server</h2>
      <p style={{ marginTop: 8, color: "#374151", maxWidth: 920 }}>
        Maestro includes an optional <strong>MCP (Model Context Protocol)</strong> server so MCP-compatible
        clients (Cursor / Claude MCP, etc.) can call Maestro as tools. The MCP server runs over{" "}
        <strong>stdio</strong> (spawned as a local process).
      </p>
      <ul style={{ lineHeight: 1.7, maxWidth: 920 }}>
        <li>
          <strong>Published docs</strong>:{" "}
          <a href="https://maestro-amber-omega.vercel.app/" target="_blank" rel="noreferrer">
            maestro-amber-omega.vercel.app
          </a>
        </li>
        <li>
          <strong>Install</strong>: <code>cd mcp-server &amp;&amp; npm install &amp;&amp; npm run build</code>
        </li>
        <li>
          <strong>Configure</strong>: set <code>MAESTRO_API_URL</code> in the MCP client to point at your
          Maestro deployment (default <code>http://localhost:3000</code>).
        </li>
      </ul>

      <h2 style={{ marginTop: 20 }}>Optional: MCP context enrichment</h2>
      <p style={{ marginTop: 8, color: "#374151", maxWidth: 920 }}>
        If a job is missing required inputs, Maestro can optionally call an external MCP-backed context
        service to fill missing fields before asking the user.
      </p>
      <ul style={{ lineHeight: 1.7, maxWidth: 920 }}>
        <li>
          <strong>Enable</strong>: set <code>MAESTRO_MCP_CONTEXT_URL</code> to an HTTP endpoint that accepts{" "}
          <code>{`{ request, missing_inputs, consumer_inputs }`}</code> and returns{" "}
          <code>{`{ filled_inputs }`}</code>.
        </li>
        <li>
          <strong>Timeout</strong>: <code>MAESTRO_MCP_TIMEOUT_MS</code> (default 2500ms)
        </li>
      </ul>

      <p style={{ marginTop: 16, color: "#374151", maxWidth: 900 }}>
        Note: For hackathon/demo resiliency, if a specialist agent is unreachable, Maestro returns a
        stub output for that step instead of failing the whole job.
      </p>
    </main>
  );
}
