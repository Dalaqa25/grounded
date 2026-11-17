"use client";

import React from "react";

/**
 * The model writes citations as [1] or [2][3] in plain text. Rather than ask it
 * for structured output — which costs tokens and breaks mid-stream — we parse
 * the markers out at render time and turn them into controls.
 */
export function CitationChip({
  n,
  active,
  onSelect,
}: {
  n: number;
  active: boolean;
  onSelect: (n: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(n)}
      title={`Jump to source ${n}`}
      className={`mx-[0.1em] inline-flex h-[1.15em] min-w-[1.15em] translate-y-[-0.12em] items-center justify-center rounded-[0.28em] px-[0.3em] align-middle font-mono text-[0.68em] font-medium transition
        ${
          active
            ? "bg-indigo-400/90 text-ink-950 ring-1 ring-indigo-300"
            : "bg-white/8 text-ink-300 ring-1 ring-white/10 hover:bg-white/15 hover:text-white"
        }`}
    >
      {n}
    </button>
  );
}

/**
 * Walks rendered markdown children and swaps [n] markers for chips, leaving
 * every other node untouched.
 */
export function withCitations(
  children: React.ReactNode,
  active: number | null,
  onSelect: (n: number) => void,
): React.ReactNode {
  return React.Children.map(children, (child, i) => {
    if (typeof child === "string") {
      const parts = child.split(/(\[\d{1,2}\])/g);
      if (parts.length === 1) return child;
      return parts.map((part, j) => {
        const match = /^\[(\d{1,2})\]$/.exec(part);
        if (!match) return <React.Fragment key={j}>{part}</React.Fragment>;
        const n = Number(match[1]);
        return (
          <CitationChip
            key={`${i}-${j}`}
            n={n}
            active={active === n}
            onSelect={onSelect}
          />
        );
      });
    }

    if (React.isValidElement(child)) {
      const props = child.props as { children?: React.ReactNode };
      if (props?.children) {
        return React.cloneElement(
          child as React.ReactElement<{ children?: React.ReactNode }>,
          { children: withCitations(props.children, active, onSelect) },
        );
      }
    }

    return child;
  });
}
