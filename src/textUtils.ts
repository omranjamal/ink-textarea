export const countTrailingEmptyLines = (text: string): number => {
  let count = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "\n") {
      count++;
    } else {
      break;
    }
  }
  return count;
};

export const findLineStart = (value: string, cursor: number): number => {
  if (cursor <= 0) return 0;
  const idx = value.lastIndexOf("\n", cursor - 1);
  return idx === -1 ? 0 : idx + 1;
};

export const findLineEnd = (value: string, cursor: number): number => {
  const idx = value.indexOf("\n", cursor);
  return idx === -1 ? value.length : idx;
};

export const findPrevWordBoundary = (value: string, cursor: number): number => {
  let pos = cursor - 1;
  while (pos >= 0 && /\s/.test(value[pos]!)) {
    pos -= 1;
  }
  while (pos >= 0 && !/\s/.test(value[pos]!)) {
    pos -= 1;
  }
  return pos + 1;
};

export const findNextWordBoundary = (value: string, cursor: number): number => {
  let pos = cursor;
  while (pos < value.length && !/\s/.test(value[pos]!)) {
    pos += 1;
  }
  while (pos < value.length && /\s/.test(value[pos]!)) {
    pos += 1;
  }
  return pos;
};

export const getCursorLineAndColumn = (
  value: string,
  cursor: number,
): { line: number; column: number } => {
  let line = 0;
  let lastLineStart = 0;
  for (let i = 0; i < cursor; i++) {
    if (value[i] === "\n") {
      line += 1;
      lastLineStart = i + 1;
    }
  }
  return { line, column: cursor - lastLineStart };
};

export const chunkString = (text: string, width: number): string[] => {
  if (width <= 0 || text.length === 0) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += width) {
    chunks.push(text.slice(i, i + width));
  }
  return chunks;
};

export const chunkLineForCursor = (
  lineText: string,
  cursorColumn: number,
  lineWidth: number,
): string[] => {
  if (lineWidth <= 0) return [lineText];
  const totalLen = Math.max(lineText.length, cursorColumn + 1);
  const numChunks = Math.max(1, Math.ceil(totalLen / lineWidth));
  return Array.from({ length: numChunks }, (_, i) =>
    lineText.slice(i * lineWidth, (i + 1) * lineWidth),
  );
};

export const renderChunkWithCursor = (
  chunk: string,
  posInChunk: number,
  cursorVisible: boolean,
  isAtLineEnd: boolean,
): string => {
  const atCursor = chunk[posInChunk] ?? " ";
  const cs = cursorVisible
    ? `\x1b[7m${atCursor}\x1b[27m`
    : atCursor === " " && isAtLineEnd
      ? " "
      : atCursor;
  return chunk.slice(0, posInChunk) + cs + chunk.slice(posInChunk + 1);
};

export const computeVisualUpCursor = (
  value: string,
  cursor: number,
  lineWidth: number,
): number => {
  const { line: currentLine, column: col } = getCursorLineAndColumn(value, cursor);
  const vRow = Math.floor(col / lineWidth);
  const vCol = col % lineWidth;

  if (vRow > 0) {
    const lineStart = findLineStart(value, cursor);
    const lineEnd = findLineEnd(value, cursor);
    return Math.min(lineStart + (vRow - 1) * lineWidth + vCol, lineEnd);
  }

  if (currentLine === 0) return findLineStart(value, cursor);

  const prevLineEnd = findLineStart(value, cursor) - 1;
  const prevLineStart = findLineStart(value, prevLineEnd);
  const prevLineLength = prevLineEnd - prevLineStart;
  const prevLastVRow = Math.floor(prevLineLength / lineWidth);
  return Math.min(
    prevLineStart + prevLastVRow * lineWidth + vCol,
    prevLineStart + prevLineLength,
  );
};

export const computeVisualDownCursor = (
  value: string,
  cursor: number,
  lineWidth: number,
): number | null => {
  const { column } = getCursorLineAndColumn(value, cursor);
  const currentLineStart = findLineStart(value, cursor);
  const currentLineEnd = findLineEnd(value, cursor);
  const currentLineLength = currentLineEnd - currentLineStart;
  const vRow = Math.floor(column / lineWidth);
  const vCol = column % lineWidth;
  const lastVRow = Math.floor(currentLineLength / lineWidth);

  if (vRow < lastVRow) {
    return Math.min(
      currentLineStart + (vRow + 1) * lineWidth + vCol,
      currentLineEnd,
    );
  }

  if (currentLineEnd >= value.length) return null;

  const nextLineStart = currentLineEnd + 1;
  const nextLineEnd = findLineEnd(value, nextLineStart);
  return Math.min(nextLineStart + vCol, nextLineEnd);
};

export type Segment = {
  readonly start: number;
  readonly end: number;
  readonly label: string;
};

export const computeLabels = (
  value: string,
  labels: Record<string, RegExp>,
): string[] => {
  const out: string[] = new Array(value.length).fill("text");
  for (const [name, regex] of Object.entries(labels)) {
    const flags = regex.flags.includes("g")
      ? regex.flags
      : regex.flags + "g";
    const re = new RegExp(regex.source, flags);
    for (const m of value.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      for (let i = start; i < end; i++) {
        if (out[i] === "text") out[i] = name;
      }
    }
  }
  return out;
};

export const computeSegments = (labelByChar: string[]): Segment[] => {
  const segs: Segment[] = [];
  if (labelByChar.length === 0) return segs;
  let start = 0;
  for (let i = 1; i <= labelByChar.length; i++) {
    if (i === labelByChar.length || labelByChar[i] !== labelByChar[start]) {
      segs.push({ start, end: i, label: labelByChar[start]! });
      start = i;
    }
  }
  return segs;
};

export const getLabelAt = (
  labelByChar: string[],
  cursor: number,
): string => {
  if (cursor < 0 || cursor >= labelByChar.length) return "text";
  return labelByChar[cursor]!;
};

export const findSegmentIndex = (
  segments: Segment[],
  cursor: number,
): number => {
  if (segments.length === 0) return 0;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    if (cursor >= s.start && cursor < s.end) return i;
  }
  return segments.length;
};

export const getCursorFromLineColumn = (
  value: string,
  line: number,
  column: number,
): { cursor: number; clampedLine: number; clampedCol: number } => {
  const lines = value.split("\n");
  const numLines = lines.length;

  const clampedLine = Math.max(0, Math.min(line, numLines - 1));

  const targetLine = lines[clampedLine] ?? "";
  let clampedCol: number;
  if (line > numLines - 1) {
    clampedCol = targetLine.length;
  } else {
    clampedCol = Math.max(0, Math.min(column, targetLine.length));
  }

  let cursor = 0;
  for (let i = 0; i < clampedLine; i++) {
    cursor += lines[i]!.length + 1;
  }
  cursor += clampedCol;

  return { cursor, clampedLine, clampedCol };
};
