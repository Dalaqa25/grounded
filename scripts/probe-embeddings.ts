/**
 * Probes which Gemini embedding models the key can use and at what dimensions.
 *
 *   npx tsx scripts/probe-embeddings.ts
 *
 * Kept in the repo because provider model ids move, and the vector column width
 * has to match whatever is chosen.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const KEY = process.env.GOOGLE_API_KEY!;
const BASE = "https://generativelanguage.googleapis.com/v1beta";

async function listEmbeddingModels(): Promise<string[]> {
  const r = await fetch(`${BASE}/models?key=${KEY}&pageSize=200`);
  const body = (await r.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
  };
  return (body.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("embedContent"))
    .map((m) => m.name.replace(/^models\//, ""));
}

async function probe(model: string, dimensions?: number) {
  const payload: Record<string, unknown> = {
    model: `models/${model}`,
    content: { parts: [{ text: "hello world" }] },
  };
  if (dimensions) payload.outputDimensionality = dimensions;

  const r = await fetch(`${BASE}/models/${model}:embedContent?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = (await r.json()) as {
    embedding?: { values: number[] };
    error?: { message: string };
  };

  const label = `${model} @ ${dimensions ?? "default"}`;
  if (body.embedding) {
    console.log(`  ok    ${label.padEnd(40)} → ${body.embedding.values.length} dims`);
    return body.embedding.values.length;
  }
  console.log(`  fail  ${label.padEnd(40)} → ${body.error?.message?.slice(0, 90)}`);
  return null;
}

async function main() {
  const models = await listEmbeddingModels();
  console.log(`\nEmbedding models for this key: ${models.join(", ") || "(none)"}\n`);

  for (const model of models) {
    await probe(model, 768);
    await probe(model);
  }
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
