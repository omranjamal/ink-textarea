import stringWidth from "string-width";
import type { TLabelRule } from "./types.js";

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

export const graphemeWidth = (g: string, tabWidth = 1): number => {
  if (g.length === 0) return 0;
  if (g === "\t") return Math.max(1, tabWidth);
  const c = g.charCodeAt(0);
  if (g.length === 1) {
    if (c >= 0x20 && c < 0x7f) return 1;
    if (c < 0x20) return 0;
  }
  return stringWidth(g);
};

const COMBINING_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0300, 0x036f],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x20d0, 0x20ff],
  [0xfe20, 0xfe2f],
];

const isLikelyCombining = (code: number): boolean => {
  for (const [lo, hi] of COMBINING_RANGES) {
    if (code >= lo && code <= hi) return true;
  }
  return false;
};

const isHighSurrogate = (code: number): boolean =>
  code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean =>
  code >= 0xdc00 && code <= 0xdfff;

export const prevGraphemeOffset = (value: string, cursor: number): number => {
  if (cursor <= 0) return 0;
  if (cursor > value.length) cursor = value.length;
  const prev = value.charCodeAt(cursor - 1);
  if (prev < 0x80 && !isLowSurrogate(prev)) {
    return cursor - 1;
  }
  let lastStart = 0;
  for (const seg of segmenter.segment(value)) {
    if (seg.index >= cursor) break;
    lastStart = seg.index;
  }
  return lastStart;
};

export const nextGraphemeOffset = (value: string, cursor: number): number => {
  if (cursor >= value.length) return value.length;
  if (cursor < 0) cursor = 0;
  const here = value.charCodeAt(cursor);
  const next = cursor + 1 < value.length ? value.charCodeAt(cursor + 1) : -1;
  if (
    here < 0x80 &&
    !isHighSurrogate(here) &&
    (next === -1 || !isLikelyCombining(next))
  ) {
    return cursor + 1;
  }
  for (const seg of segmenter.segment(value)) {
    const segEnd = seg.index + seg.segment.length;
    if (segEnd > cursor) return segEnd;
  }
  return value.length;
};

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
  rows?: readonly VisualRow[],
): number => {
  if (rows && rows.length > 0 && lineWidth > 0) {
    const { line, column } = getCursorLineAndColumn(value, cursor);
    const idx = visualRowForCursor(rows, line, column, lineWidth);
    if (idx <= 0) return findLineStart(value, cursor);
    const cur = rows[idx]!;
    const prev = rows[idx - 1]!;
    if (prev.isVirtualLine) return findLineStart(value, cursor);
    const offsetInCur = cursor - cur.absStart;
    return prev.absStart + Math.min(offsetInCur, prev.text.length);
  }

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
  rows?: readonly VisualRow[],
): number | null => {
  if (rows && rows.length > 0 && lineWidth > 0) {
    const { line, column } = getCursorLineAndColumn(value, cursor);
    const idx = visualRowForCursor(rows, line, column, lineWidth);
    if (idx < 0) return null;
    // Skip past virtual padding rows when scanning for next non-virtual row.
    let nextIdx = idx + 1;
    while (nextIdx < rows.length && rows[nextIdx]!.isVirtualLine) nextIdx += 1;
    if (nextIdx >= rows.length) return null;
    const cur = rows[idx]!;
    const next = rows[nextIdx]!;
    const offsetInCur = cursor - cur.absStart;
    return next.absStart + Math.min(offsetInCur, next.text.length);
  }

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
  labels: readonly TLabelRule[],
): string[] => {
  if (labels.length === 0 || value.length === 0) return [];
  const out: string[] = new Array(value.length).fill("text");
  for (const rule of labels) {
    const flags = rule.pattern.flags.includes("g")
      ? rule.pattern.flags
      : rule.pattern.flags + "g";
    const re = new RegExp(rule.pattern.source, flags);
    for (const m of value.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (end === start) continue;
      const resolved =
        typeof rule.label === "string" ? rule.label : rule.label(m);
      if (!resolved) continue;
      for (let i = start; i < end; i++) {
        if (out[i] === "text") out[i] = resolved;
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

import ansiStyles from "ansi-styles";
import type { TStyleProps } from "./types.js";

export type StyleAnsi = {
  readonly open: string;
  readonly close: string;
  readonly unsupported: boolean;
};

const ansiPair = (
  styler: unknown,
): { open: string; close: string } | null => {
  if (!styler || typeof styler !== "object") return null;
  const s = styler as { open?: unknown; close?: unknown };
  if (typeof s.open !== "string" || typeof s.close !== "string") return null;
  return { open: s.open, close: s.close };
};

const resolveColor = (
  name: string,
): { open: string; close: string } | null => {
  const named = (ansiStyles.color as unknown as Record<string, unknown>)[name];
  const pair = ansiPair(named);
  if (pair) return pair;
  if (name.startsWith("#")) {
    try {
      const code = ansiStyles.hexToAnsi256(name);
      return { open: ansiStyles.color.ansi256(code), close: ansiStyles.color.close };
    } catch {
      return null;
    }
  }
  return null;
};

const resolveBgColor = (
  name: string,
): { open: string; close: string } | null => {
  const bgKey = "bg" + name.charAt(0).toUpperCase() + name.slice(1);
  const named = (ansiStyles.bgColor as unknown as Record<string, unknown>)[
    bgKey
  ];
  const pair = ansiPair(named);
  if (pair) return pair;
  if (name.startsWith("#")) {
    try {
      const code = ansiStyles.hexToAnsi256(name);
      return { open: ansiStyles.bgColor.ansi256(code), close: ansiStyles.bgColor.close };
    } catch {
      return null;
    }
  }
  return null;
};

export const styleToAnsi = (s: TStyleProps): StyleAnsi => {
  let open = "";
  let close = "";
  let unsupported = false;

  const apply = (pair: { open: string; close: string } | null): void => {
    if (!pair) {
      unsupported = true;
      return;
    }
    open += pair.open;
    close = pair.close + close;
  };

  if (s.bold) apply(ansiPair(ansiStyles.bold));
  if (s.dim) apply(ansiPair(ansiStyles.dim));
  if (s.italic) apply(ansiPair(ansiStyles.italic));
  if (s.underline) apply(ansiPair(ansiStyles.underline));
  if (s.strikethrough) apply(ansiPair(ansiStyles.strikethrough));
  if (s.inverse) apply(ansiPair(ansiStyles.inverse));
  if (s.color) apply(resolveColor(s.color));
  if (s.bgColor) apply(resolveBgColor(s.bgColor));

  return { open, close, unsupported };
};

export type VisualRow = {
  readonly lineIdx: number;
  readonly chunkIdx: number;
  readonly absStart: number;
  readonly text: string;
  readonly isLastChunkOfLine: boolean;
  readonly isVirtualLine: boolean;
};

export const buildVisualRows = (
  lines: readonly string[],
  lineWidth: number,
  cursorLine: number,
  cursorColumn: number,
  initialLineCount: number,
  tabWidth = 1,
): VisualRow[] => {
  const rows: VisualRow[] = [];
  let absStart = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx]!;
    const lineAbsStart = absStart;

    if (lineWidth <= 0 || lineText.length === 0) {
      rows.push({
        lineIdx,
        chunkIdx: 0,
        absStart: lineAbsStart,
        text: lineText,
        isLastChunkOfLine: true,
        isVirtualLine: false,
      });
    } else {
      let chunkBuf = "";
      let chunkVisualWidth = 0;
      let chunkSliceStart = 0;
      let chunkIdx = 0;
      let lastChunkVisualWidth = 0;

      const flushChunk = (isLast: boolean): void => {
        rows.push({
          lineIdx,
          chunkIdx,
          absStart: lineAbsStart + chunkSliceStart,
          text: chunkBuf,
          isLastChunkOfLine: isLast,
          isVirtualLine: false,
        });
        lastChunkVisualWidth = chunkVisualWidth;
        chunkIdx += 1;
        chunkSliceStart += chunkBuf.length;
        chunkBuf = "";
        chunkVisualWidth = 0;
      };

      const isAsciiSimple = (() => {
        for (let i = 0; i < lineText.length; i++) {
          const c = lineText.charCodeAt(i);
          if (c >= 0x80 || c < 0x20) return false;
        }
        return true;
      })();

      if (isAsciiSimple) {
        // Fast path: code-unit slicing equals visual slicing.
        for (let i = 0; i < lineText.length; i += lineWidth) {
          chunkBuf = lineText.slice(i, i + lineWidth);
          chunkVisualWidth = chunkBuf.length;
          flushChunk(i + lineWidth >= lineText.length);
        }
      } else {
        for (const seg of segmenter.segment(lineText)) {
          const g = seg.segment;
          const gw = graphemeWidth(g, tabWidth);
          if (chunkVisualWidth + gw > lineWidth && chunkBuf.length > 0) {
            flushChunk(false);
          }
          chunkBuf += g;
          chunkVisualWidth += gw;
        }
        flushChunk(true);
      }

      const isCursorLine = lineIdx === cursorLine;
      const cursorWantsExtraRow =
        isCursorLine &&
        cursorColumn === lineText.length &&
        cursorColumn > 0 &&
        lastChunkVisualWidth === lineWidth;
      if (cursorWantsExtraRow) {
        const prev = rows[rows.length - 1]!;
        rows[rows.length - 1] = { ...prev, isLastChunkOfLine: false };
        rows.push({
          lineIdx,
          chunkIdx,
          absStart: lineAbsStart + lineText.length,
          text: "",
          isLastChunkOfLine: true,
          isVirtualLine: false,
        });
      }
    }

    absStart = lineAbsStart + lineText.length + 1; // +1 for the \n
  }

  const padCount = Math.max(0, initialLineCount - lines.length);
  for (let p = 0; p < padCount; p++) {
    rows.push({
      lineIdx: lines.length + p,
      chunkIdx: 0,
      absStart,
      text: "",
      isLastChunkOfLine: true,
      isVirtualLine: true,
    });
  }

  return rows;
};

export const visualRowForCursor = (
  rows: readonly VisualRow[],
  cursorLine: number,
  cursorColumn: number,
  lineWidth: number,
): number => {
  if (lineWidth <= 0) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      if (row.lineIdx === cursorLine && !row.isVirtualLine) return i;
    }
    return -1;
  }
  let lineAbsStart = -1;
  let pick = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (row.lineIdx !== cursorLine || row.isVirtualLine) {
      if (lineAbsStart >= 0) break;
      continue;
    }
    if (lineAbsStart < 0) lineAbsStart = row.absStart;
    const chunkStartCol = row.absStart - lineAbsStart;
    if (chunkStartCol <= cursorColumn) {
      pick = i;
    } else {
      break;
    }
  }
  return pick;
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
