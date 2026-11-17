/**
 * Lists the Groq models your key can use.
 *
 *   npm run models
 *
 * Providers retire model ids. When GROQ_MODEL stops working, this tells you
 * what to put there instead rather than leaving you to guess.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

async function main() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error("GROQ_API_KEY is not set. Copy .env.example to .env.local first.");
    process.exit(1);
  }

  const response = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    console.error(`Groq returned ${response.status}: ${await response.text()}`);
    process.exit(1);
  }

  const body = (await response.json()) as {
    data: { id: string; owned_by: string; context_window?: number; active?: boolean }[];
  };

  const rows = body.data
    .filter((m) => m.active !== false)
    .sort((a, b) => a.id.localeCompare(b.id));

  const current = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  console.log(`\n\x1b[1mGroq models available to this key\x1b[0m  (current: ${current})\n`);

  for (const model of rows) {
    const mark = model.id === current ? "\x1b[32m→\x1b[0m" : " ";
    const context = model.context_window
      ? `\x1b[2m${(model.context_window / 1000).toFixed(0)}k ctx\x1b[0m`
      : "";
    console.log(`${mark} ${model.id.padEnd(42)} ${context}`);
  }

  if (!rows.some((m) => m.id === current)) {
    console.log(
      `\n\x1b[33mGROQ_MODEL "${current}" is not in this list. Pick one above and set it in .env.local.\x1b[0m`,
    );
  }
  console.log();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
