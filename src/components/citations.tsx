"use client";

import React from "react";

const SUPERSCRIPT = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPT[Number(d)])
    .join("");
}

/**
 * A footnote marker, not a chip.
 *
 * The whole interface argues that an answer is a cited document, so the
 * citation should look like one: a raised numeral tight against the word it
 * follows, in the accent ink. It is still a button — pressing it opens the
 * passage in the apparatus — but at rest it reads as typography.
 */
export function FootnoteMarker({
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
      title={`Source ${n}`}
      aria-label={`Open source ${n}`}
      className={`cursor-pointer align-baseline font-medium transition-colors ${
        active ? "underline decoration-2 underline-offset-2" : "hover:opacity-70"
      }`}
      style={{ color: "var(--accent)" }}
    >
      {toSuperscript(n)}
    </button>
  );
}

/**
 * Walks rendered markdown children and swaps [n] markers for footnote
 * numerals, leaving every other node untouched.
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
        return (
          <FootnoteMarker
            key={`${i}-${j}`}
            n={Number(match[1])}
            active={active === Number(match[1])}
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
