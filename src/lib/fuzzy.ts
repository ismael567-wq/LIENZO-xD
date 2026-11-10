/**
 * Búsqueda difusa ligera para el catálogo de tableros y la búsqueda global.
 * Puntúa por coincidencia exacta de subcadena y luego por subsecuencia, con
 * bonificación por palabras al inicio y por cercanía entre letras.
 */
export function fuzzyScore(query: string, text: string): number {
  const needle = query.trim().toLowerCase();
  const haystack = text.toLowerCase();
  if (!needle) return 0;
  if (haystack === needle) return 1000;
  const direct = haystack.indexOf(needle);
  if (direct >= 0) {
    const boundary = direct === 0 || /[\s\-_/.]/.test(haystack[direct - 1]);
    return 700 + (boundary ? 120 : 0) + Math.max(0, 120 - direct);
  }
  let score = 0;
  let cursor = 0;
  let streak = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, cursor);
    if (found < 0) return 0;
    const boundary = found === 0 || /[\s\-_/.]/.test(haystack[found - 1]);
    score += 8 + (boundary ? 12 : 0) + Math.max(0, 6 - (found - cursor));
    streak = found === cursor ? streak + 1 : 0;
    score += streak * 4;
    cursor = found + 1;
  }
  return score;
}

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  textOf: (item: T) => string,
  limit = 40,
): T[] {
  const clean = query.trim();
  if (!clean) return items.slice(0, limit);
  return items
    .map((item) => ({ item, score: fuzzyScore(clean, textOf(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

/** Partes de un texto que coinciden con la consulta, para resaltarlas. */
export function fuzzySegments(query: string, text: string): Array<{ text: string; hit: boolean }> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const segments: Array<{ text: string; hit: boolean }> = [];
  let cursor = 0;
  for (const char of needle) {
    const found = lower.indexOf(char, cursor);
    if (found < 0) return [{ text, hit: false }];
    if (found > cursor) segments.push({ text: text.slice(cursor, found), hit: false });
    segments.push({ text: text.slice(found, found + 1), hit: true });
    cursor = found + 1;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments;
}
