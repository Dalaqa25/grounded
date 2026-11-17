/**
 * Models are inconsistent about citation brackets: gpt-oss reaches for the
 * full-width 【1】, others emit (1) or [Source 1]. Normalising in one place —
 * used by both the UI and the evaluation suite — means swapping the generation
 * model cannot silently break the citation chips or quietly score a correct
 * answer as ungrounded.
 */
export function normaliseCitations(text: string): string {
  return text
    .replace(/[【［]\s*(\d{1,2})\s*[】］]/g, "[$1]")
    .replace(/\[\s*(?:source|ref|citation)s?\s*[:#]?\s*(\d{1,2})\s*\]/gi, "[$1]");
}

/** The citation numbers an answer actually uses, in order of appearance. */
export function citedNumbers(text: string): number[] {
  return [...normaliseCitations(text).matchAll(/\[(\d{1,2})\]/g)].map((m) =>
    Number(m[1]),
  );
}

/**
 * Detects a refusal without pattern-matching one model's phrasing.
 *
 * The reliable signal is structural rather than lexical: every grounded answer
 * is required to cite, so an answer with no citations at all that also says
 * something negative about the sources is a decline. Matching only on wording
 * scored three correct refusals as failures in an earlier run, because the
 * model said "the sources do not mention" where the regex expected "could not
 * find".
 */
export function looksLikeRefusal(text: string): boolean {
  if (citedNumbers(text).length > 0) return false;
  return /\b(do(es)? not|don'?t|no|not|cannot|can'?t|unable to)\b[^.]{0,60}\b(mention|address|contain|cover|include|specify|state|find|provide|information|detail)(s|ed|ing)?\b/i.test(
    text,
  );
}
