import { describe, it, expect } from "vitest";
import {
  countTrailingEmptyLines,
  findLineStart,
  findLineEnd,
  findPrevWordBoundary,
  findNextWordBoundary,
  getCursorLineAndColumn,
  getCursorFromLineColumn,
  chunkString,
  chunkLineForCursor,
  renderChunkWithCursor,
  computeVisualUpCursor,
  computeVisualDownCursor,
  computeLabels,
  computeSegments,
  getLabelAt,
  findSegmentIndex,
} from "../src/textUtils.js";

describe("countTrailingEmptyLines", () => {
  it("returns 0 for empty string", () => {
    expect(countTrailingEmptyLines("")).toBe(0);
  });

  it("returns 0 when no trailing newlines", () => {
    expect(countTrailingEmptyLines("hello")).toBe(0);
  });

  it("returns 1 for single trailing newline", () => {
    expect(countTrailingEmptyLines("hello\n")).toBe(1);
  });

  it("returns N for multiple trailing newlines", () => {
    expect(countTrailingEmptyLines("hello\n\n\n")).toBe(3);
  });

  it("returns full count for string that is only newlines", () => {
    expect(countTrailingEmptyLines("\n\n")).toBe(2);
  });

  it("does not count internal newlines", () => {
    expect(countTrailingEmptyLines("a\nb\nc")).toBe(0);
  });
});

describe("findLineStart", () => {
  it("returns 0 when cursor is at 0", () => {
    expect(findLineStart("hello", 0)).toBe(0);
  });

  it("returns 0 for single-line string", () => {
    expect(findLineStart("hello", 3)).toBe(0);
  });

  it("returns correct start for second line", () => {
    // "hello\nworld" — cursor at 8 (index of 'r') → line start is 6
    expect(findLineStart("hello\nworld", 8)).toBe(6);
  });

  it("returns correct start when cursor is right after newline", () => {
    expect(findLineStart("hello\nworld", 6)).toBe(6);
  });

  it("returns 0 when cursor is on first line", () => {
    expect(findLineStart("hello\nworld", 3)).toBe(0);
  });

  it("handles multiline correctly", () => {
    // "a\nb\nc" — cursor at 4 (the 'c') → line start is 4
    expect(findLineStart("a\nb\nc", 4)).toBe(4);
  });
});

describe("findLineEnd", () => {
  it("returns string length when no newline", () => {
    expect(findLineEnd("hello", 0)).toBe(5);
  });

  it("returns index of next newline", () => {
    expect(findLineEnd("hello\nworld", 0)).toBe(5);
  });

  it("returns index of newline when cursor is in the middle", () => {
    expect(findLineEnd("hello\nworld", 2)).toBe(5);
  });

  it("returns string length when cursor is on last line", () => {
    expect(findLineEnd("hello\nworld", 6)).toBe(11);
  });

  it("handles cursor at newline position", () => {
    expect(findLineEnd("a\nb", 1)).toBe(1);
  });

  it("handles empty lines", () => {
    // "a\n\nb" — cursor at 0 (line 'a') → end is 1
    expect(findLineEnd("a\n\nb", 0)).toBe(1);
  });
});

describe("findPrevWordBoundary", () => {
  it("returns 0 when at start of string", () => {
    expect(findPrevWordBoundary("hello", 0)).toBe(0);
  });

  it("jumps to start of current word", () => {
    expect(findPrevWordBoundary("hello world", 10)).toBe(6);
  });

  it("skips whitespace then jumps to start of previous word", () => {
    // cursor after 'world' trailing space → lands at 'w'
    expect(findPrevWordBoundary("hello world", 11)).toBe(6);
  });

  it("jumps to start of word on current line", () => {
    // "hello\nworld" — cursor at 8 (mid 'world') → start of 'world' (6)
    expect(findPrevWordBoundary("hello\nworld", 8)).toBe(6);
  });

  it("crosses newline to start of word on previous line", () => {
    // cursor at 6 (start of 'world') → skip '\n', skip 'hello' → 0
    expect(findPrevWordBoundary("hello\nworld", 6)).toBe(0);
  });

  it("crosses multiple blank lines to previous word", () => {
    expect(findPrevWordBoundary("hello\n\n\nworld", 8)).toBe(0);
  });

  it("handles single character word", () => {
    expect(findPrevWordBoundary("a b", 3)).toBe(2);
  });
});

describe("findNextWordBoundary", () => {
  it("returns end of string when at start of last word", () => {
    expect(findNextWordBoundary("hello", 0)).toBe(5);
  });

  it("jumps past current word and trailing whitespace to next word start", () => {
    // from pos 0: skip 'hello' (0-4), skip space (5), land at 'w' (6)
    expect(findNextWordBoundary("hello world", 0)).toBe(6);
  });

  it("from whitespace: skips whitespace to next word start", () => {
    // from pos 5 (the space): skip space, land at 'w' (6)
    expect(findNextWordBoundary("hello world", 5)).toBe(6);
  });

  it("crosses newline to next word", () => {
    // from pos 0: skip 'hello', skip '\n', land at 'w' on next line (6)
    expect(findNextWordBoundary("hello\nworld", 0)).toBe(6);
  });

  it("from newline: skips newline to next word", () => {
    expect(findNextWordBoundary("hello\nworld", 5)).toBe(6);
  });

  it("crosses multiple blank lines to next word", () => {
    expect(findNextWordBoundary("hello\n\n\nworld", 5)).toBe(8);
  });
});

describe("getCursorLineAndColumn", () => {
  it("returns 0,0 for empty string cursor at 0", () => {
    expect(getCursorLineAndColumn("", 0)).toEqual({ line: 0, column: 0 });
  });

  it("returns correct column on first line", () => {
    expect(getCursorLineAndColumn("hello", 3)).toEqual({ line: 0, column: 3 });
  });

  it("returns line 1 after first newline", () => {
    expect(getCursorLineAndColumn("hello\nworld", 6)).toEqual({
      line: 1,
      column: 0,
    });
  });

  it("returns correct line and column in multiline", () => {
    // "a\nb\nc" — cursor at 4 ('c') → line 2, col 0
    expect(getCursorLineAndColumn("a\nb\nc", 4)).toEqual({
      line: 2,
      column: 0,
    });
  });

  it("cursor at end of string", () => {
    expect(getCursorLineAndColumn("hello", 5)).toEqual({ line: 0, column: 5 });
  });

  it("cursor at newline character position", () => {
    // cursor at index 5 (the '\n') → still line 0, col 5
    expect(getCursorLineAndColumn("hello\nworld", 5)).toEqual({
      line: 0,
      column: 5,
    });
  });
});

describe("getCursorFromLineColumn", () => {
  it("returns 0 for line 0, col 0", () => {
    expect(getCursorFromLineColumn("hello\nworld", 0, 0)).toEqual({
      cursor: 0,
      clampedLine: 0,
      clampedCol: 0,
    });
  });

  it("returns correct cursor for valid line and col", () => {
    // "hello\nworld" line 1, col 3 → cursor = 6 + 3 = 9
    expect(getCursorFromLineColumn("hello\nworld", 1, 3)).toEqual({
      cursor: 9,
      clampedLine: 1,
      clampedCol: 3,
    });
  });

  it("clamps line to last line when exceeding total lines", () => {
    const result = getCursorFromLineColumn("hello\nworld", 5, 0);
    expect(result.clampedLine).toBe(1);
    expect(result.clampedCol).toBe(5); // end of last line
  });

  it("clamps column to line length", () => {
    const result = getCursorFromLineColumn("hello\nworld", 0, 100);
    expect(result.clampedLine).toBe(0);
    expect(result.clampedCol).toBe(5);
  });

  it("clamps negative line to 0", () => {
    const result = getCursorFromLineColumn("hello", -1, 0);
    expect(result.clampedLine).toBe(0);
  });

  it("clamps negative column to 0", () => {
    const result = getCursorFromLineColumn("hello", 0, -5);
    expect(result.clampedCol).toBe(0);
  });

  it("handles Infinity line — clamps to last line end", () => {
    const result = getCursorFromLineColumn("hello\nworld", Infinity, 0);
    expect(result.clampedLine).toBe(1);
    expect(result.clampedCol).toBe(5);
  });

  it("handles Infinity column — clamps to line length", () => {
    const result = getCursorFromLineColumn("hello\nworld", 0, Infinity);
    expect(result.clampedLine).toBe(0);
    expect(result.clampedCol).toBe(5);
  });
});

describe("chunkString", () => {
  it("returns array with empty string for empty input", () => {
    expect(chunkString("", 10)).toEqual([""]);
  });

  it("returns original string when width is 0", () => {
    expect(chunkString("hello", 0)).toEqual(["hello"]);
  });

  it("returns single chunk when text is shorter than width", () => {
    expect(chunkString("hello", 10)).toEqual(["hello"]);
  });

  it("returns single chunk when text equals width", () => {
    expect(chunkString("hello", 5)).toEqual(["hello"]);
  });

  it("splits into two chunks when text exceeds width", () => {
    expect(chunkString("abcdef", 5)).toEqual(["abcde", "f"]);
  });

  it("splits evenly into equal chunks", () => {
    expect(chunkString("abcdefghij", 5)).toEqual(["abcde", "fghij"]);
  });

  it("last chunk is shorter when not evenly divisible", () => {
    expect(chunkString("abcdefgh", 5)).toEqual(["abcde", "fgh"]);
  });

  it("splits into three chunks", () => {
    expect(chunkString("abcdefghijklmno", 5)).toEqual([
      "abcde",
      "fghij",
      "klmno",
    ]);
  });

  it("splits at width=1 into individual characters", () => {
    expect(chunkString("abc", 1)).toEqual(["a", "b", "c"]);
  });
});

describe("chunkLineForCursor", () => {
  it("returns whole line when lineWidth=0", () => {
    expect(chunkLineForCursor("hello", 2, 0)).toEqual(["hello"]);
  });

  it("splits line into chunks of lineWidth", () => {
    expect(chunkLineForCursor("abcdefghij", 0, 5)).toEqual(["abcde", "fghij"]);
  });

  it("adds extra empty chunk when cursor at exact width boundary past end", () => {
    expect(chunkLineForCursor("abcde", 5, 5)).toEqual(["abcde", ""]);
  });

  it("returns single empty chunk for empty line", () => {
    expect(chunkLineForCursor("", 0, 5)).toEqual([""]);
  });
});

describe("renderChunkWithCursor", () => {
  const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

  it("places cursor on a character", () => {
    const result = renderChunkWithCursor("hello", 2, true, false);
    expect(result).toContain("\x1b[7ml\x1b[27m");
    expect(strip(result)).toBe("hello");
  });

  it("renders highlighted space at cursor past end when visible", () => {
    const result = renderChunkWithCursor("hi", 2, true, true);
    expect(result).toContain("\x1b[7m \x1b[27m");
    expect(strip(result)).toBe("hi ");
  });

  it("renders plain space at cursor past end when invisible", () => {
    expect(renderChunkWithCursor("hi", 2, false, true)).toBe("hi ");
  });

  it("renders plain character when cursor on char and invisible", () => {
    expect(renderChunkWithCursor("hello", 1, false, false)).toBe("hello");
  });

  it("renders highlighted cursor in empty chunk", () => {
    const result = renderChunkWithCursor("", 0, true, true);
    expect(result).toContain("\x1b[7m \x1b[27m");
  });
});

describe("computeVisualUpCursor", () => {
  it("on visual row 0 of logical line 0: returns line start", () => {
    // "abcde", lineWidth=5, cursor=2 → row 0, col 2 → can't go up, returns 0
    expect(computeVisualUpCursor("abcde", 2, 5)).toBe(0);
  });

  it("moves up within same logical line (row 1 → row 0)", () => {
    // "abcdefghij", lineWidth=5, cursor=7 → row 1, vCol 2 → row 0, vCol 2 → position 2
    expect(computeVisualUpCursor("abcdefghij", 7, 5)).toBe(2);
  });

  it("preserves visual column when moving up within logical line", () => {
    // "abcdefghijklmno", lineWidth=5, cursor=12 → row 2, vCol 2 → row 1, vCol 2 → 7
    expect(computeVisualUpCursor("abcdefghijklmno", 12, 5)).toBe(7);
  });

  it("moves from visual row 0 of logical line 1 to last visual row of line 0", () => {
    // "abcdefghij\nklmno", lineWidth=5, cursor=11 ('k') → line 1, row 0, vCol 0
    // prev line "abcdefghij" (10 chars), prevLastVRow=2, target=2*5+0=10 → clamped to 10 ('\n')
    expect(computeVisualUpCursor("abcdefghij\nklmno", 11, 5)).toBe(10);
  });

  it("preserves visual column when crossing logical line boundary", () => {
    // "abcdefghij\nklmno", lineWidth=5, cursor=13 ('m') → line 1, row 0, vCol 2
    // prev line "abcdefghij" (10 chars), prevLastVRow=2, target=2*5+2=12 > 10 → clamp to 10
    expect(computeVisualUpCursor("abcdefghij\nklmno", 13, 5)).toBe(10);
  });

  it("clamps to prev line end when visual column exceeds prev line length", () => {
    // "ab\ncdefghij", lineWidth=5, cursor=7 ('h') → line 1, col 4, row 0, vCol 4
    // prev line "ab" (length 2), prevLastVRow=0, target=0*5+4=4 → clamp to min(4,2)=2
    expect(computeVisualUpCursor("ab\ncdefghij", 7, 5)).toBe(2);
  });

  it("with lineWidth larger than line: moves to previous logical line directly", () => {
    // "hello\nworld", lineWidth=10, cursor=6 ('w') → line 1, row 0, vCol 0
    // prev line "hello" (5 chars), prevLastVRow=0, target=0*10+0=0 → pos 0
    expect(computeVisualUpCursor("hello\nworld", 6, 10)).toBe(0);
  });
});

describe("computeVisualDownCursor", () => {
  it("moves down within same logical line (row 0 → row 1)", () => {
    // "abcdefghij", lineWidth=5, cursor=2 → row 0, vCol 2 → row 1: min(5+2, 10)=7
    expect(computeVisualDownCursor("abcdefghij", 2, 5)).toBe(7);
  });

  it("preserves visual column when moving down within logical line", () => {
    // "abcdefghijklmno", lineWidth=5, cursor=7 → row 1, vCol 2 → row 2: min(10+2,15)=12
    expect(computeVisualDownCursor("abcdefghijklmno", 7, 5)).toBe(12);
  });

  it("clamps to line end when next visual row exceeds content", () => {
    // "abcde", lineWidth=5, cursor=2 → row 0, vCol 2, lastVRow=1
    // row 0 < 1 → min(0+5+2, 5)=min(7,5)=5
    expect(computeVisualDownCursor("abcde", 2, 5)).toBe(5);
  });

  it("moves to next logical line from last visual row", () => {
    // "abcde\nfghij", lineWidth=5, cursor=5 ('\n', end of line 0, row 1, vCol 0)
    // vRow=1, lastVRow=1 → not < lastVRow → next line: min(6+0, 11)=6
    expect(computeVisualDownCursor("abcde\nfghij", 5, 5)).toBe(6);
  });

  it("preserves visual column when moving to next logical line", () => {
    // "abcde\nfghij", lineWidth=5, cursor=5 with vCol=0 → position 6 (start of fghij)
    // Try with a longer first line so we can have vCol > 0 at last row
    // "abcdefghij\nklmno", lineWidth=5, cursor=10 ('\n', vRow=2, vCol=0)
    // next line: min(11+0, 16)=11
    expect(computeVisualDownCursor("abcdefghij\nklmno", 10, 5)).toBe(11);
  });

  it("clamps visual column to next line end when shorter", () => {
    // "abcdefghij\nkl", lineWidth=5, cursor=10 ('\n', vRow=2, vCol=0)
    // next line "kl" (2 chars), nextLineEnd=13
    // min(11+0, 13)=11 (start of "kl")
    // Now try vCol > next line length:
    // "abcdefghij\nkl", lineWidth=5, cursor=9 ('j', vRow=1, vCol=4)
    // lastVRow = floor(10/5)=2. vRow(1) < 2 → min(0+10+4, 10)=min(14,10)=10 (line end '\n')
    // Hmm, that moves within same line. Let me try cursor at '\n' with vCol=3:
    // Need cursor past last visual row. "abcde\nkl", lineWidth=5, cursor=5, vRow=1, vCol=0
    // but also need vCol preserved across lines...
    // "abcdefgh\nkl", lineWidth=5, cursor=8 ('\n', col=8, vRow=1, vCol=3)
    // lastVRow = floor(8/5)=1. vRow(1) NOT < 1 → next line
    // next line "kl" (2 chars). min(9+3, 11)=min(12,11)=11 → clamps to line end
    expect(computeVisualDownCursor("abcdefgh\nkl", 8, 5)).toBe(11);
  });

  it("returns null on last logical line when past all visual rows", () => {
    // "abcde", lineWidth=5, cursor=5 (end) → vRow=1, lastVRow=1 → last line → null
    expect(computeVisualDownCursor("abcde", 5, 5)).toBeNull();
  });

  it("returns null on single-line text when past all visual rows", () => {
    // "hello", lineWidth=10, cursor=5 → vRow=0, lastVRow=floor(5/10)=0 → last line → null
    expect(computeVisualDownCursor("hello", 5, 10)).toBeNull();
  });

  it("returns null on last logical line of multiline text", () => {
    // "line1\nline2", lineWidth=10, cursor=11 (end) → last logical line → null
    expect(computeVisualDownCursor("line1\nline2", 11, 10)).toBeNull();
  });
});

describe("computeLabels", () => {
  it("labels chars matching a regex with the key name", () => {
    const out = computeLabels("hi there", { word: /[a-zA-Z]{2,}/g });
    expect(out).toEqual([
      "word", "word", "text", "word", "word", "word", "word", "word",
    ]);
  });

  it("first key wins when ranges overlap", () => {
    const out = computeLabels("abcdef", { a: /[a-z]+/g, b: /[a-c]+/g });
    expect(out.every((l) => l === "a")).toBe(true);
  });

  it("does not infinite-loop on zero-length matches", () => {
    const out = computeLabels("abc", { z: /(?:)/g });
    expect(out).toEqual(["text", "text", "text"]);
  });

  it("returns empty array for empty value", () => {
    expect(computeLabels("", { w: /\\w+/g })).toEqual([]);
  });
});

describe("computeSegments", () => {
  it("returns alternating runs by label", () => {
    const labelByChar = computeLabels("hi there", { word: /[a-zA-Z]{2,}/g });
    expect(computeSegments(labelByChar)).toEqual([
      { start: 0, end: 2, label: "word" },
      { start: 2, end: 3, label: "text" },
      { start: 3, end: 8, label: "word" },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(computeSegments([])).toEqual([]);
  });
});

describe("getLabelAt", () => {
  it("returns label of char at cursor", () => {
    const labelByChar = ["word", "word", "text", "word"];
    expect(getLabelAt(labelByChar, 0)).toBe("word");
    expect(getLabelAt(labelByChar, 2)).toBe("text");
  });

  it("returns text past end of value", () => {
    expect(getLabelAt(["word", "word"], 5)).toBe("text");
  });

  it("returns text for negative cursor", () => {
    expect(getLabelAt(["word"], -1)).toBe("text");
  });
});

describe("findSegmentIndex", () => {
  it("returns index of segment containing the cursor", () => {
    const segs = [
      { start: 0, end: 2, label: "word" },
      { start: 2, end: 3, label: "text" },
      { start: 3, end: 8, label: "word" },
    ];
    expect(findSegmentIndex(segs, 0)).toBe(0);
    expect(findSegmentIndex(segs, 2)).toBe(1);
    expect(findSegmentIndex(segs, 5)).toBe(2);
  });

  it("returns segments.length when cursor past end", () => {
    const segs = [{ start: 0, end: 2, label: "word" }];
    expect(findSegmentIndex(segs, 5)).toBe(1);
  });

  it("returns 0 for empty segments", () => {
    expect(findSegmentIndex([], 0)).toBe(0);
  });
});
