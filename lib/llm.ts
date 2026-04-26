import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local before calling the LLM."
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function askClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const resp = await client().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = resp.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  return text.trim();
}
