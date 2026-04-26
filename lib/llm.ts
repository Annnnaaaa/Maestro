import OpenAI from "openai";

let _client: OpenAI | null = null;

function client(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env.local before calling the LLM."
    );
  }
  _client = new OpenAI({ apiKey });
  return _client;
}

export async function askLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const model = process.env.MAESTRO_OPENAI_MODEL ?? "gpt-4o-mini";
  const resp = await client().chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.2,
  });

  return (resp.choices[0]?.message?.content ?? "").trim();
}
