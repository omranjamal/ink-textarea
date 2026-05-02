import { describe, it, expect } from "vitest";
import {
  computeLabels,
  computeSegments,
  getLabelAt,
  findSegmentIndex,
} from "../../src/textUtils.js";

describe("computeLabels", () => {
  it("labels chars matching a regex with the rule label", () => {
    const out = computeLabels("hi there", [
      { pattern: /[a-zA-Z]{2,}/g, label: "word" },
    ]);
    expect(out).toEqual([
      "word",
      "word",
      "text",
      "word",
      "word",
      "word",
      "word",
      "word",
    ]);
  });

  it("first rule wins when ranges overlap", () => {
    const out = computeLabels("abcdef", [
      { pattern: /[a-z]+/g, label: "a" },
      { pattern: /[a-c]+/g, label: "b" },
    ]);
    expect(out.every((l) => l === "a")).toBe(true);
  });

  it("does not infinite-loop on zero-length matches", () => {
    const out = computeLabels("abc", [{ pattern: /(?:)/g, label: "z" }]);
    expect(out).toEqual(["text", "text", "text"]);
  });

  it("returns empty array for empty value", () => {
    expect(computeLabels("", [{ pattern: /\w+/g, label: "w" }])).toEqual([]);
  });

  it("function label returns string applied to match", () => {
    const out = computeLabels("hi", [
      { pattern: /.+/g, label: (m) => m[0].toUpperCase() },
    ]);
    expect(out).toEqual(["HI", "HI"]);
  });

  it("function label returning undefined leaves match unlabeled", () => {
    const out = computeLabels("/train /tomato", [
      {
        pattern: /\/[a-z]+/g,
        label: (m) => (m[0] === "/train" ? "cmd" : undefined),
      },
    ]);
    // "/train" → cmd (6 chars), " " → text, "/tomato" → text (7 chars)
    expect(out.slice(0, 6)).toEqual(["cmd", "cmd", "cmd", "cmd", "cmd", "cmd"]);
    expect(out.slice(6)).toEqual(Array(8).fill("text"));
  });

  it("multiple rules can map to same label", () => {
    const out = computeLabels("ab12", [
      { pattern: /[a-z]+/g, label: "tok" },
      { pattern: /[0-9]+/g, label: "tok" },
    ]);
    expect(out).toEqual(["tok", "tok", "tok", "tok"]);
  });
});

describe("computeSegments", () => {
  it("returns alternating runs by label", () => {
    const labelByChar = computeLabels("hi there", [
      { pattern: /[a-zA-Z]{2,}/g, label: "word" },
    ]);
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
