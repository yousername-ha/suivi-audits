/** Mise en liste visuelle uniquement : les lignes explicites sont prioritaires.
 * Dans un paragraphe, les virgules et points-virgules hors guillemets/parenthèses séparent les entrées. */
export function lignesInterfaces(value: string): string[] {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1) return lines;
  const text = lines[0]!;
  const result: string[] = [];
  let start = 0,
    depth = 0,
    quote = '';
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quote) {
      if (character === quote && text[index - 1] !== '\\') quote = '';
    } else if (character === '"' || character === '«') quote = character === '«' ? '»' : '"';
    else if (character === '(' || character === '[') depth++;
    else if (character === ')' || character === ']') depth = Math.max(0, depth - 1);
    else if (
      depth === 0 &&
      (character === ';' ||
        (character === ',' && !(/\d/.test(text[index - 1] ?? '') && /\d/.test(text[index + 1] ?? ''))))
    ) {
      result.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(text.slice(start).trim());
  return result.filter(Boolean);
}
