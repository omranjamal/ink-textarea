import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useState, type ReactNode } from "react";
import { TextArea, LineNumber } from "../../src/index.js";
import type { TLinePrefixFn } from "../../src/types.js";
import { tick, settle } from "../_util/wait.js";

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const strip = (frame: string | undefined): string =>
  (frame ?? "").replace(ANSI_RE, "");

const lineCount = (frame: string | undefined): number =>
  (frame ?? "").split("\n").length;

type ControlledHostProps = {
  initial: string;
  viewportLines?: number;
  linePrefix?: TLinePrefixFn;
};

const ControlledHost = ({
  initial,
  viewportLines,
  linePrefix,
}: ControlledHostProps): ReactNode => {
  const [value, setValue] = useState(initial);
  const [cursor, setCursor] = useState<[number, number]>([0, 0]);
  return (
    <TextArea
      isActive={true}
      onSubmit={() => {}}
      value={value}
      cursorPosition={cursor}
      onChange={setValue}
      onCursorChange={(p) => setCursor(p)}
      viewportLines={viewportLines}
      linePrefix={linePrefix}
    />
  );
};

describe("TextArea > viewport virtualization", () => {
  it("renders all rows when viewportLines is undefined (back-compat)", async () => {
    const value = Array.from({ length: 6 }, (_, i) => `line${i}`).join("\n");
    const { lastFrame } = render(
      <TextArea
        isActive={false}
        onSubmit={() => {}}
        value={value}
        cursorPosition={[0, 0]}
        onChange={() => {}}
      />,
    );
    await tick();
    const frame = lastFrame();
    for (let i = 0; i < 6; i++) {
      expect(frame).toContain(`line${i}`);
    }
  });

  it("renders only viewportLines rows when set", async () => {
    const value = Array.from({ length: 20 }, (_, i) => `row${i}`).join("\n");
    const { lastFrame } = render(
      <TextArea
        isActive={false}
        onSubmit={() => {}}
        value={value}
        cursorPosition={[0, 0]}
        onChange={() => {}}
        viewportLines={5}
      />,
    );
    await tick();
    const frame = lastFrame();
    // First 5 rows visible
    expect(frame).toContain("row0");
    expect(frame).toContain("row4");
    // Beyond viewport not visible
    expect(frame).not.toContain("row5");
    expect(frame).not.toContain("row19");
  });

  it("scrolls down to keep cursor visible when cursor moves past viewport", async () => {
    const value = Array.from({ length: 20 }, (_, i) => `row${i}`).join("\n");
    const { stdin, lastFrame } = render(
      <ControlledHost initial={value} viewportLines={5} />,
    );
    await tick();

    for (let i = 0; i < 7; i++) {
      stdin.write("\x1b[B");
      await settle(lastFrame);
    }

    const frame = strip(lastFrame());
    expect(frame).toContain("row7");
    expect(frame).not.toContain("row0");
  });

  it("scrolls back up when cursor returns to top", async () => {
    const value = Array.from({ length: 20 }, (_, i) => `row${i}`).join("\n");
    const { stdin, lastFrame } = render(
      <ControlledHost initial={value} viewportLines={5} />,
    );
    await tick();

    for (let i = 0; i < 8; i++) {
      stdin.write("\x1b[B");
      await settle(lastFrame);
    }
    expect(strip(lastFrame())).not.toContain("row0");

    for (let i = 0; i < 8; i++) {
      stdin.write("\x1b[A");
      await settle(lastFrame);
    }
    expect(strip(lastFrame())).toContain("row0");
  }, 30000);

  it("clamps viewportLines below 1 to 1", async () => {
    const value = Array.from({ length: 5 }, (_, i) => `r${i}`).join("\n");
    const { lastFrame } = render(
      <TextArea
        isActive={false}
        onSubmit={() => {}}
        value={value}
        cursorPosition={[0, 0]}
        onChange={() => {}}
        viewportLines={0}
      />,
    );
    await tick();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("r0");
    expect(frame).not.toContain("r1");
  });

  it("preserves absolute line numbers in linePrefix under scroll", async () => {
    const value = Array.from({ length: 20 }, (_, i) => `row${i}`).join("\n");
    const { stdin, lastFrame } = render(
      <ControlledHost
        initial={value}
        viewportLines={5}
        linePrefix={({ lineNumber, totalLines, isActiveLine }) => (
          <Text>
            <LineNumber
              lineNumber={lineNumber}
              totalLines={totalLines}
              isActive={isActiveLine}
            />
            {" "}
          </Text>
        )}
      />,
    );
    await tick();

    for (let i = 0; i < 12; i++) {
      stdin.write("\x1b[B");
      await settle(lastFrame);
    }

    const frame = strip(lastFrame());
    // After 12 down-presses, cursor sits well past the initial viewport.
    expect(/\brow0\b/.test(frame)).toBe(false);
    // Some row 5+ visible with absolute line number > 5.
    const hasHighRow = /row(?:[5-9]|1[0-9])/.test(frame);
    expect(hasHighRow).toBe(true);
    const hasHighLineNumber = /(?:^|\s)([6-9]|1[0-9])\s/.test(frame);
    expect(hasHighLineNumber).toBe(true);
  }, 30000);

  it("does not exceed viewportLines visible rows after typing many newlines", async () => {
    const { stdin, lastFrame } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        viewportLines={3}
      />,
    );
    await tick();

    // Write all keystrokes in one shot — ink's stdin handler processes
    // them sequentially, no per-press race window. Single settle at the
    // end is then bounded by one renderer settle, not 16.
    let seq = "";
    for (let i = 0; i < 8; i++) seq += `x${i}\x0a`;
    stdin.write(seq);
    await settle(lastFrame);

    const frame = lastFrame();
    // We don't assert exact count (chrome rows etc) but ensure recent input visible
    // and earliest input scrolled out.
    expect(frame).toContain("x7");
    expect(frame).not.toContain("x0");
    // Visible row count cannot exceed viewportLines
    expect(lineCount(frame)).toBeLessThanOrEqual(3);
  });

  it("works with viewportLines greater than rowCount (no scroll)", async () => {
    const value = "a\nb\nc";
    const { lastFrame } = render(
      <TextArea
        isActive={false}
        onSubmit={() => {}}
        value={value}
        cursorPosition={[0, 0]}
        onChange={() => {}}
        viewportLines={50}
      />,
    );
    await tick();
    const frame = lastFrame();
    expect(frame).toContain("a");
    expect(frame).toContain("b");
    expect(frame).toContain("c");
  });
});
