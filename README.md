# Maestro

Maestro is an **LLM-powered orchestrator** that takes a high-level request,
inspects its marketplace of specialist agents, plans which agents to run
(including LLM-based selection when multiple agents can do the same thing),
pays each step over the **Lightning Network**, and aggregates the outputs.

This repo includes:
- **Maestro backend** (Next.js 14, port 3000)
- **Demo UI** (`maestro-ui/`, Vite + TanStack Start, port 8080 by default)
- **Specialist sub-agents** (`agents/`, ports 3001–3003)
- **MCP server** (`mcp-server/`, stdio)

## GitHub repo

- **Repo**: `https://github.com/Annnnaaaa/maestro`
- You can also pass a repo URL into MCP/clients to give Maestro more context during a demo (product docs, brand assets, install steps, etc.).

## Run locally (recommended: all services)

This repo runs:
- Maestro backend: `http://localhost:3000`
- UI dashboard: `http://localhost:8080`
- Specialist agents:
  - script-agent `http://localhost:3001`
  - voice-agent `http://localhost:3002`
  - visual-agent `http://localhost:3003`

```bash
npm install
npm --prefix maestro-ui install
npm --prefix agents/script-agent install
npm --prefix agents/voice-agent install
npm --prefix agents/visual-agent install
npm run dev:all
```

Open:
- UI: `http://localhost:8080`
- Backend: `http://localhost:3000`

### UI configuration

The UI reads the backend base URL from:
- `VITE_BACKEND_URL` (defaults to `http://localhost:3000`)

Example (PowerShell):

```powershell
$env:VITE_BACKEND_URL="http://localhost:3000"
npm --prefix maestro-ui run dev
```

## Environment variables

Create `.env.local` (or copy `.env.example` if present).

| Var | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Used by `lib/llm.ts` (planner + agent selector). |
| `MAESTRO_OPENAI_MODEL` | Optional. Defaults to `gpt-4o-mini`. |
| `ANTHROPIC_API_KEY` | Optional. Enables Anthropic-backed selection in some flows and the `script-agent` (Claude). |
| `NWC_CONNECTION_STRING` | Nostr Wallet Connect URL for the shared Alby Hub wallet. |
| `USE_STUB_LIGHTNING` | Set `true` to skip the real wallet and run on the in-memory ledger. |
| `NEXT_PUBLIC_DASHBOARD_URL` | URL of the demo dashboard, displayed on `/`. |
| `OPENAI_API_KEY` (in `agents/voice-agent`) | Required for OpenAI TTS (`tts-1`). |
| `FAL_KEY` (in `agents/visual-agent`) | Optional for generating stills; visual agent has a demo fallback if absent. |

## Quickstart (API)

1) Create a job (plan + invoice):

```bash
curl -s http://localhost:3000/api/maestro/job \
  -H "Content-Type: application/json" \
  -d '{
    "request": "Make a 15s playful product video for GlowBottle",
    "inputs": {
      "product_name": "GlowBottle",
      "product_description": "A self-cleaning water bottle that stays fresh all day.",
      "target_audience": "busy commuters",
      "visual_context": "clean minimal bright studio, crisp typography",
      "voiceover_tone": "warm and playful",
      "duration_seconds": 15
    }
  }'
```

2) Demo-only: mark it paid (skips real Lightning settlement):

```bash
curl -s -X POST http://localhost:3000/api/maestro/job/<jobId>/mark-paid
```

3) Execute (payment-gated) and stream progress (SSE):

```bash
curl -N -s -X POST http://localhost:3000/api/maestro/job/<jobId>/execute
```

## MCP server (optional)

This repo includes a stdio MCP server in `mcp-server/` so MCP-compatible clients (Claude MCP, Cursor, etc.) can call Maestro as tools.

```bash
cd mcp-server
npm install
npm run build
```

Then point your MCP client at `node <ABS_PATH>/mcp-server/dist/index.js` and set `MAESTRO_API_URL`.

### MCP setup notes (Claude / Cursor / ChatGPT-style clients)

Maestro’s MCP server is **stdio**, which means the client must be able to spawn a local process and talk to it over stdin/stdout.

- **Claude Desktop / Claude MCP**: add an `mcpServers` entry that runs `node .../mcp-server/dist/index.js` and sets `MAESTRO_API_URL`.
- **Cursor**: add a new MCP server using the same `command`, `args`, and `env`.
- **ChatGPT**: use any MCP-capable host/bridge that supports stdio MCP servers, and point it at the same command (the MCP server itself is client-agnostic).

Example config (edit paths):

```json
{
  "mcpServers": {
    "maestro": {
      "command": "node",
      "args": ["<ABS_PATH>/mcp-server/dist/index.js"],
      "env": { "MAESTRO_API_URL": "http://localhost:3000" }
    }
  }
}
```

### UI screenshots

No screenshots are committed yet. If you want them to show on GitHub:
- run the UI (`http://localhost:8080`)
- take screenshots of **Landing**, **Consumer Chat**, and **Operations Dashboard**
- save them under `docs/screenshots/` and link them from this README.

## Legacy setup (single service)

If you only want Maestro without the local sub-agents:

```bash
npm install
npm run dev
```

Server starts on `http://localhost:3000`. On boot you should see a line like:

```
Maestro started. Marketplace has ... agents with capabilities: [...]
```

## Architecture

Everything in the system - including Maestro itself - publishes the same
manifest schema (see [`lib/manifest-schema.ts`](lib/manifest-schema.ts)).

Submitting a task:

1. **`POST /api/maestro/job`** with `{ request, inputs? }`.
2. Maestro calls `planTask()` ([`lib/planner.ts`](lib/planner.ts)). For known
   categories it uses a template ([`lib/templates.ts`](lib/templates.ts));
   otherwise it asks the LLM to compose a plan from the marketplace's current
   capabilities.
3. If no agent can supply a needed capability: returns
   `{ status: "no_capability_match", reason }`.
4. If feasible but the consumer hasn't supplied the first step's
   `required_inputs`: returns `{ status: "missing_inputs", missing_inputs }`.
5. Otherwise: prices the plan (subtotal + 15% Maestro margin), creates a
   Lightning invoice for the total, and stores the job. Returns
   `{ status: "ready", jobId, plan, pricing, invoice }`.

Executing:

6. **`POST /api/maestro/job/:jobId/execute`** opens an SSE stream (payment-gated).
7. First event is `{ step: "planning", plan }` so the dashboard can show the
   plan before any payment fires.
8. Then per step: `{ step: "hiring", agent, capability }` -> Lightning
   payment -> `{ step: "working", agent, paymentSent }` -> agent call ->
   `{ step: "working", agent, output }`.
9. Final event: `{ step: "complete", finalOutput }`.

If a sub-agent endpoint is unreachable, Maestro returns a stub output for
that step rather than failing the whole job - the demo keeps running.

## Endpoints

All endpoints allow CORS from any origin (demo).

### `GET /api/agent/manifest`

Returns Maestro's own `AgentManifest` (orchestrator type, capability
`video_orchestration`, hires capabilities `video_script_writing`,
`voiceover_generation`, `video_visual_generation`).

### `POST /api/maestro/job`

```json
// Request
{
  "request": "Make a 30s playful video for our new dog treat brand 'Bork Bites'",
  "inputs": {
    "product_name": "Bork Bites",
    "product_description": "...",
    "visual_context": "...",
    "target_audience": "millennial pet parents"
  }
}
```

Response shapes:

```jsonc
// Plan is missing required inputs:
{ "status": "missing_inputs", "missing_inputs": ["product_description"], "for_agent": "script-agent-v1", "plan": {...} }

// Marketplace can't fulfill the task:
{ "status": "no_capability_match", "reason": "..." }

// Ready to execute:
{
  "status": "ready",
  "jobId": "job_abc123",
  "plan": { "feasible": true, "steps": [...], "total_cost_sats": 68, "planner_source": "template" },
  "pricing": { "subtotal": 68, "margin": 11, "total": 79 },
  "invoice": { "invoice": "lnbc...", "payment_hash": "..." }
}
```

### `POST /api/maestro/job/:jobId/execute`

Streams events:

```jsonc
{ "step": "planning", "plan": { ... } }
{ "step": "hiring", "agent": "script-agent-v1", "capability": "video_script_writing" }
{ "step": "working", "agent": "script-agent-v1", "paymentSent": 15 }
{ "step": "working", "agent": "script-agent-v1", "output": { ... } }
// ... next agent ...
{ "step": "complete", "finalOutput": { "script-agent-v1": {...}, "voice-agent-v1": {...}, ... } }
```

### `GET /api/marketplace`

Returns `{ "agents": AgentManifest[] }`.

### `POST /api/marketplace`

Body: a full `AgentManifest`. Validates and stores it. (See
[`lib/manifest-schema.ts`](lib/manifest-schema.ts) for the shape.)

## File map

```
app/
  api/
    agent/manifest/route.ts   # GET: Maestro's own manifest
    maestro/
      job/route.ts            # POST: plan + price + invoice
      job/[jobId]/execute     # POST: SSE pipeline runner (payment-gated)
      job/[jobId]/mark-paid   # POST: demo-only payment shortcut
    marketplace/route.ts      # GET / POST agent manifests
  layout.tsx
  page.tsx
lib/
  cors.ts                     # CORS helpers
  lightning.ts                # Real Alby Hub / NWC + virtual ledger + stub fallback
  llm.ts                      # askClaude(system, user)
  manifest-schema.ts          # AgentManifest type + isManifest guard
  marketplace.ts              # in-memory store of AgentManifests + endpoint seeding
  planner.ts                  # planTask(): template fast-path -> Claude free planning
  templates.ts                # known-task fast paths (currently: product_video)
  maestro.ts                  # job lifecycle, executeJob generator, maestroManifest
instrumentation.ts            # startup: seed marketplace + log summary
agents/
  script-agent/               # Next.js specialist service (3001)
  voice-agent/                # Next.js specialist service (3002)
  visual-agent/               # Next.js specialist service (3003)
mcp-server/                   # stdio MCP server exposing Maestro as tools
```

## Notes / hackathon scope

- **No database.** State lives in `Map`s on `globalThis`.
- **Lightning has a real path.** `lib/lightning.ts` uses Alby Hub via NWC
  when `NWC_CONNECTION_STRING` is set; falls back to a stub ledger when
  `USE_STUB_LIGHTNING=true` or when the wallet is unreachable.
- **Sub-agents can be down.** Maestro returns stubbed outputs for any
  unreachable agent so the pipeline always completes.
- **No tests, no auth.**
