export function locateQuote(content: string, quote: string) {
  if (quote.trim().length < 8 || quote.length > 5000) return null;
  const pattern = quote
    .trim()
    .split(/\s+/u)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const match = new RegExp(pattern, "iu").exec(content);
  return match
    ? { start: match.index, end: match.index + match[0].length, text: match[0] }
    : null;
}
