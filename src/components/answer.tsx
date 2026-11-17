"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normaliseCitations } from "@/lib/citations";
import { withCitations } from "./citations";

interface Props {
  content: string;
  activeCitation: number | null;
  onSelectCitation: (n: number) => void;
}

export function Answer({ content, activeCitation, onSelectCitation }: Props) {
  const normalised = normaliseCitations(content);
  const wrap = (children: React.ReactNode) =>
    withCitations(children, activeCitation, onSelectCitation);

  return (
    <div className="prose-answer">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{wrap(children)}</p>,
          li: ({ children }) => <li>{wrap(children)}</li>,
          td: ({ children }) => <td>{wrap(children)}</td>,
          th: ({ children }) => <th>{wrap(children)}</th>,
          h1: ({ children }) => <h3>{wrap(children)}</h3>,
          h2: ({ children }) => <h3>{wrap(children)}</h3>,
          h3: ({ children }) => <h3>{wrap(children)}</h3>,
          strong: ({ children }) => <strong>{wrap(children)}</strong>,
          em: ({ children }) => <em>{wrap(children)}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {normalised}
      </Markdown>
    </div>
  );
}
