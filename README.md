# Maestro

General-purpose orchestrator backend. Maestro is an LLM-powered agent that
takes any task, inspects its marketplace of specialists, plans which agents
to hire, and runs the pipeline - paying each step over Lightning.

This package is the **backend only** - Next.js 14 App Router, deployable to
Vercel. Today the marketplace is seeded with video specialists, so video
jobs work end-to-end. Tomorrow, when more specialists register, Maestro
handles those job types too with no code changes here.

## Setup

```bash
npm install
cp .env.example .env.local
# edit .env.local: OPENAI_API_KEY (required), NWC_CONNECTION_STRING (or USE_STUB_LIGHTNING=true)
npm run dev
```

Server starts on `http://localhost:3000`. On boot you'll see a line like:

```
Maestro started. Marketplace has 3 agents with capabilities: [video_script_writing, voiceover_generation, video_visual_generation]
```

## Environment variables

| Var | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required. Used by `lib/llm.ts` (planner LLM). |
| `MAESTRO_OPENAI_MODEL` | Optional. Defaults to `gpt-4o-mini`. |
| `NWC_CONNECTION_STRING` | Nostr Wallet Connect URL for the shared Alby Hub wallet. |
| `USE_STUB_LIGHTNING` | Set `true` to skip the real wallet entirely and run on the in-memory ledger. |
| `NEXT_PUBLIC_DASHBOARD_URL` | URL of the demo dashboard, displayed on `/`. |

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

6. **`POST /api/maestro/execute`** with `{ jobId }` opens an SSE stream.
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
{ "status": "missing_inputs", "missing_inputs": ["product_description"], "for_agent": "script-agent", "plan": {...} }

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

### `POST /api/maestro/execute`

Body: `{ "jobId": "..." }`. Streams events:

```jsonc
{ "step": "planning", "plan": { ... } }
{ "step": "hiring", "agent": "script-agent", "capability": "video_script_writing" }
{ "step": "working", "agent": "script-agent", "paymentSent": 15 }
{ "step": "working", "agent": "script-agent", "output": { ... } }
// ... next agent ...
{ "step": "complete", "finalOutput": { "script-agent": {...}, "voice-agent": {...}, ... } }
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
      execute/route.ts        # POST: SSE pipeline runner (emits "planning" first)
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
```

## Notes / hackathon scope

- **No database.** State lives in `Map`s on `globalThis`.
- **Lightning has a real path.** `lib/lightning.ts` uses Alby Hub via NWC
  when `NWC_CONNECTION_STRING` is set; falls back to a stub ledger when
  `USE_STUB_LIGHTNING=true` or when the wallet is unreachable.
- **Sub-agents can be down.** Maestro returns stubbed outputs for any
  unreachable agent so the pipeline always completes.
- **No tests, no auth.**
