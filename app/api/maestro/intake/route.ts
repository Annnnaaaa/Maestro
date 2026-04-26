import { NextRequest } from "next/server";
import { corsPreflight, withCors } from "@/lib/cors";
import { askLLM } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return corsPreflight();
}

type IntakeRequest = {
  request?: string;
};

type IntakeResponse = {
  extracted_inputs: Record<string, unknown>;
  notes?: string;
};

function safeJsonParse(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const match = candidate.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
  let body: IntakeRequest;
  try {
    body = (await req.json()) as IntakeRequest;
  } catch {
    return withCors({ error: "invalid JSON body" }, { status: 400 });
  }

  const request = (body.request ?? "").trim();
  if (!request) return withCors({ error: "request is required" }, { status: 400 });

  // If no LLM configured, return empty extraction (UI will ask missing fields).
  if (!process.env.OPENAI_API_KEY) {
    const resp: IntakeResponse = { extracted_inputs: {}, notes: "OPENAI_API_KEY not set; no extraction" };
    return withCors(resp);
  }

  const system = `You are Maestro's intake parser.
Extract any structured fields already present in the user's request.
Return ONLY JSON: { "extracted_inputs": { ... }, "notes": "..." }.
Only include fields you are confident about. Do not guess.`;

  const user = `User request:
${request}

Extract these fields when present:
- product_name (string)
- product_description (string)
- target_audience (string)
- visual_context (string)
- style (string)
- duration_seconds (number)
- voiceover_tone (string)

If a field is not present, omit it.`;

  try {
    const raw = await askLLM(system, user);
    const parsed = safeJsonParse(raw) as IntakeResponse | null;
    const extracted_inputs =
      parsed && typeof parsed === "object" && parsed.extracted_inputs && typeof parsed.extracted_inputs === "object"
        ? (parsed.extracted_inputs as Record<string, unknown>)
        : {};
    const notes = parsed && typeof parsed.notes === "string" ? parsed.notes : undefined;
    return withCors({ extracted_inputs, ...(notes ? { notes } : {}) });
  } catch (e) {
    return withCors(
      { extracted_inputs: {}, notes: `intake extraction failed: ${(e as Error).message}` },
      { status: 200 }
    );
  }
  } catch (e) {
    return withCors(
      { error: "intake_failed", message: (e as Error).message },
      { status: 500 }
    );
  }
}

