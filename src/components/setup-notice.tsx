const STEPS = [
  {
    label: "Create the schema",
    body: "Run supabase/schema.sql in the Supabase SQL editor. It enables pgvector and installs the hybrid_search function.",
  },
  {
    label: "Add the keys",
    body: "cp .env.example .env.local, then fill in the Supabase URL and secret key, a Groq key, and a Google AI Studio key for embeddings.",
  },
  {
    label: "Load the corpora",
    body: "npm run ingest — chunks, embeds and stores all three workspaces. About two minutes.",
  },
];

export function SetupNotice({ variant = "env" }: { variant?: "env" | "empty" }) {
  return (
    <main className="mx-auto max-w-[86rem] px-6 pt-16">
      <div className="max-w-[58ch]">
        <p className="label" style={{ color: "var(--accent)" }}>
          Not configured
        </p>
        <h1 className="mt-2 text-[1.9rem] leading-tight tracking-[-0.015em]">
          {variant === "env" ? "Three keys away" : "The shelves are empty"}
        </h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed text-ink-muted">
          {variant === "env"
            ? "Grounded needs three free accounts: Supabase for storage and search, Groq for generation, and Google AI Studio for embeddings."
            : "The database is reachable but holds no passages yet. Run the ingest script to load the demo workspaces."}
        </p>

        <ol className="mt-9 border-t border-rule">
          {STEPS.map((step, i) => (
            <li key={step.label} className="flex gap-4 border-b border-rule py-3.5">
              <span className="figure-num shrink-0 pt-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[1rem] leading-snug">{step.label}</p>
                <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-muted">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-5 text-[0.85rem] italic text-ink-faint">
          Full instructions are in the README.
        </p>
      </div>
    </main>
  );
}
