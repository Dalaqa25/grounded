"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "grounded-theme";

/**
 * Three-state in spirit, two-state in the control: if the reader has never
 * chosen, the system preference wins; once they choose, that choice sticks.
 * The attribute is also written by an inline script in the document head, so
 * the first paint is already correct.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      return;
    }
    setTheme(
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    );
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private browsing — the choice just will not persist */
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => choose(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light" : "Dark"}
      className="group flex h-7 items-center gap-1.5 border border-rule px-2 transition-colors hover:border-rule-strong"
    >
      <Glyph dark={false} active={theme === "light"} />
      <span className="h-3 w-px bg-rule" />
      <Glyph dark active={isDark} />
    </button>
  );
}

function Glyph({ dark, active }: { dark: boolean; active: boolean }) {
  return (
    <span
      className={`transition-opacity ${active ? "opacity-100" : "opacity-30"}`}
      style={{ color: active ? "var(--accent)" : "var(--ink-faint)" }}
    >
      {dark ? (
        <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden>
          <path
            d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8 5.6 5.6 0 1 0 13.2 9.6Z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M8 1.2v1.6M8 13.2v1.6M14.8 8h-1.6M2.8 8H1.2M12.8 3.2l-1.1 1.1M4.3 11.7l-1.1 1.1M12.8 12.8l-1.1-1.1M4.3 4.3 3.2 3.2"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}
