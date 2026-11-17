/**
 * Seeds the demo corpora.
 *
 *   npm run ingest            # all three workspaces
 *   npm run ingest -- talent  # just one
 *
 * Re-running is safe: each workspace is cleared and rebuilt, so the corpus in
 * the database always matches the files on disk.
 */
import { config } from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

import { chunkMarkdown } from "../src/lib/chunk";
import { embedDocuments } from "../src/lib/embeddings";
import { MODES } from "../src/lib/modes";
import { supabaseAdmin } from "../src/lib/supabase";

const DATA_DIR = path.join(process.cwd(), "data");

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

async function ingestWorkspace(workspace: string, dir: string) {
  const db = supabaseAdmin();
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();

  if (!files.length) {
    console.log(red(`  no .md files in ${dir}`));
    return;
  }

  console.log(`\n${bold(workspace)} ${dim(`· ${files.length} files`)}`);

  const { error: clearError } = await db
    .from("documents")
    .delete()
    .eq("workspace", workspace);
  if (clearError) throw new Error(`Clearing ${workspace}: ${clearError.message}`);

  let totalChunks = 0;

  for (const file of files) {
    const raw = await readFile(path.join(dir, file), "utf8");
    const title = (raw.match(/^#\s+(.+)$/m)?.[1] ?? file.replace(/\.md$/, "")).trim();

    const { data: doc, error: docError } = await db
      .from("documents")
      .insert({
        workspace,
        title,
        source_path: `data/${workspace}/${file}`,
        meta: { bytes: raw.length },
      })
      .select("id")
      .single();

    if (docError || !doc) throw new Error(`Inserting ${file}: ${docError?.message}`);

    const chunks = await chunkMarkdown(title, raw);
    const vectors = await embedDocuments(chunks.map((c) => c.content));

    const rows = chunks.map((chunk, i) => ({
      document_id: doc.id,
      workspace,
      chunk_index: chunk.index,
      content: chunk.content,
      embedding: vectors[i] as unknown as string,
    }));

    const { error: chunkError } = await db.from("chunks").insert(rows);
    if (chunkError) throw new Error(`Chunks for ${file}: ${chunkError.message}`);

    totalChunks += rows.length;
    console.log(`  ${green("ok")} ${title} ${dim(`· ${rows.length} chunks`)}`);
  }

  console.log(dim(`  ${totalChunks} chunks total`));
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const targets = MODES.filter((m) => !only.length || only.includes(m.workspace));

  if (!targets.length) {
    console.error(
      red(`Unknown workspace. Options: ${MODES.map((m) => m.workspace).join(", ")}`),
    );
    process.exit(1);
  }

  const started = Date.now();
  for (const mode of targets) {
    await ingestWorkspace(mode.workspace, path.join(DATA_DIR, mode.workspace));
  }

  const { data: stats } = await supabaseAdmin().rpc("workspace_stats");
  console.log(`\n${bold("Corpus")}`);
  for (const row of (stats ?? []) as { workspace: string; documents: number; chunks: number }[]) {
    console.log(`  ${row.workspace.padEnd(10)} ${row.documents} docs  ${row.chunks} chunks`);
  }
  console.log(dim(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s`));
}

main().catch((error) => {
  console.error(red(`\n${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
});
