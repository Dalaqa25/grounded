import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export interface Chunk {
  index: number;
  /** Text that gets embedded — includes the heading breadcrumb. */
  content: string;
  heading: string | null;
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 900,
  chunkOverlap: 150,
  separators: ["\n## ", "\n### ", "\n#### ", "\n\n", "\n", ". ", " ", ""],
});

/**
 * Splits markdown into chunks and prefixes each one with its document title and
 * nearest heading.
 *
 * Without that breadcrumb a chunk like "Up to EUR 800 in the first year" is
 * unanchored: the embedding has no idea it is about equipment budget, and a
 * question about equipment will not retrieve it. Carrying a little structure
 * into the chunk text is the cheapest retrieval win available.
 */
export async function chunkMarkdown(title: string, markdown: string): Promise<Chunk[]> {
  const sections = splitByHeading(markdown);
  const chunks: Chunk[] = [];

  for (const section of sections) {
    const parts = await splitter.splitText(section.body.trim());
    for (const part of parts) {
      if (part.trim().length < 40) continue;
      const breadcrumb = section.heading ? `${title} — ${section.heading}` : title;
      chunks.push({
        index: chunks.length,
        heading: section.heading,
        content: `${breadcrumb}\n\n${part.trim()}`,
      });
    }
  }

  return chunks;
}

function splitByHeading(markdown: string): { heading: string | null; body: string }[] {
  const lines = markdown.split("\n");
  const sections: { heading: string | null; body: string }[] = [];
  let heading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n");
    if (body.trim()) sections.push({ heading, body });
    buffer = [];
  };

  for (const line of lines) {
    const match = /^(#{1,4})\s+(.*)$/.exec(line);
    if (match) {
      flush();
      heading = match[2].trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return sections.length ? sections : [{ heading: null, body: markdown }];
}
