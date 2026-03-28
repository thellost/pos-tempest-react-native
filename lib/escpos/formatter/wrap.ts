/**
 * lib/escpos/formatter/wrap.ts
 *
 * Text wrapping and truncation utilities for fixed-width receipt printing.
 *
 * All functions work in terms of character count, not pixels.
 * For CJK characters (each occupying 2 columns), use charWidth() before
 * calling these — or switch to a visual-width library if needed.
 */

// ── wrapText ──────────────────────────────────────────────────────────────────

/**
 * Wraps `text` to at most `maxChars` characters per line, splitting on word
 * boundaries where possible.  Hard-wraps words longer than `maxChars`.
 *
 * @param text      Input string (may contain existing newlines)
 * @param maxChars  Maximum characters per output line
 * @returns Array of lines, none longer than maxChars
 *
 * @example
 *   wrapText('Hello World', 8)  // ['Hello', 'World']
 *   wrapText('Hi', 8)           // ['Hi']
 */
export function wrapText(text: string, maxChars: number): string[] {
  if (maxChars <= 0) return [text];

  const result: string[] = [];

  // Preserve existing newlines — split first, then wrap each segment.
  for (const segment of text.split('\n')) {
    if (segment.length === 0) {
      result.push('');
      continue;
    }

    const words = segment.split(' ');
    let currentLine = '';

    for (const word of words) {
      // Hard-wrap words that are longer than maxChars
      const chunks = hardChunk(word, maxChars);

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];

        if (currentLine.length === 0) {
          // Starting fresh line
          currentLine = chunk;
        } else if (currentLine.length + 1 + chunk.length <= maxChars) {
          // Fits on the current line with a space
          currentLine += ' ' + chunk;
        } else {
          // Flush current line and start new one
          result.push(currentLine);
          currentLine = chunk;
        }
      }
    }

    if (currentLine.length > 0 || words.length === 0) {
      result.push(currentLine);
    }
  }

  return result;
}

// ── truncate ──────────────────────────────────────────────────────────────────

/**
 * Hard-truncates `text` to at most `maxChars` characters.
 * If truncation occurs, the last characters are replaced with `ellipsis`.
 *
 * @example
 *   truncate('Hello World', 8)        // 'Hello W…'
 *   truncate('Hello World', 8, '..') // 'Hello ..'
 *   truncate('Hi', 8)                 // 'Hi'
 */
export function truncate(
  text: string,
  maxChars: number,
  ellipsis = '…',
): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= ellipsis.length) return ellipsis.slice(0, maxChars);
  return text.slice(0, maxChars - ellipsis.length) + ellipsis;
}

// ── padEnd / padStart helpers ─────────────────────────────────────────────────

/**
 * Pads `text` to exactly `width` characters on the right (left-aligns text).
 * Truncates if `text` is already longer than `width`.
 */
export function padEnd(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

/**
 * Pads `text` to exactly `width` characters on the left (right-aligns text).
 * Truncates if `text` is already longer than `width`.
 */
export function padStart(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return ' '.repeat(width - text.length) + text;
}

/**
 * Centers `text` within `width` characters.
 * Extra space goes to the right side.
 * Truncates if `text` is already longer than `width`.
 */
export function padCenter(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const total = width - text.length;
  const left  = Math.floor(total / 2);
  const right = total - left;
  return ' '.repeat(left) + text + ' '.repeat(right);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Splits a single word into hard chunks of at most `maxChars` characters.
 * Returns the word unchanged if it fits within maxChars.
 */
function hardChunk(word: string, maxChars: number): string[] {
  if (word.length <= maxChars) return [word];
  const chunks: string[] = [];
  for (let i = 0; i < word.length; i += maxChars) {
    chunks.push(word.slice(i, i + maxChars));
  }
  return chunks;
}
