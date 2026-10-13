/** The parenthetical duplicates the Poor scan badge and the page itself. */
export function shortDocName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+—.*$/, "")
    .trim()
}
