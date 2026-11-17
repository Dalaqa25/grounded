import { Terminal } from "lucide-react";

const STEPS = [
  {
    label: "Create the schema",
    body: "Run supabase/schema.sql in the Supabase SQL editor. It enables pgvector and creates the hybrid_search function.",
  },
  {
    label: "Add your keys",
    body: "cp .env.example .env.local, then fill in the Supabase URL and service-role key, a Groq key, and a Google AI Studio key for embeddings.",
  },
  {
    label: "Load the corpora",
    body: "npm run ingest — chunks, embeds and stores the three demo workspaces. Takes about a minute.",
  },
];

export function SetupNotice({ variant = "env" }: { variant?: "env" | "empty" }) {
  return (
    <main className="flex min-w-0 flex-1 items-center justify-center px-6 py-10">
      <div className="panel w-full max-w-xl rounded-2xl p-7">
        <div className="flex size-9 items-center justify-center rounded-xl bg-amber-400/12 ring-1 ring-amber-400/25">
          <Terminal className="size-4 text-amber-300" strokeWidth={2} />
        </div>

        <h1 className="mt-4 text-[19px] font-semibold tracking-tight text-white">
          {variant === "env" ? "Almost there" : "The corpus is empty"}
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-300">
          {variant === "env"
            ? "Grounded needs three free accounts: Supabase for storage and search, Groq for generation, and Google AI Studio for embeddings."
            : "The database is reachable but has no chunks in it yet. Run the ingest script to load the demo workspaces."}
        </p>

        <ol className="mt-6 flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex gap-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-white/7 font-mono text-[11px] text-ink-300 ring-1 ring-white/10">
                {i + 1}
              </span>
              <div>
                <p className="text-[13.5px] font-medium text-ink-100">{step.label}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-400">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 border-t border-white/7 pt-4 text-[12px] text-ink-500">
          Full instructions are in the README.
        </p>
      </div>
    </main>
  );
}
