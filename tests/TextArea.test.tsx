import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { TextArea, LineNumber } from "../src/index.js";
import { Text } from "ink";
import React from "react";

describe("TextArea", () => {
  it("renders placeholder when empty and inactive", () => {
    const { lastFrame } = render(
      <TextArea
        isActive={false}
        onSubmit={() => {}}
        placeholder="Type here..."
      />,
    );

    expect(lastFrame()).toContain("Type here...");
  });

  it("renders cursor when active and empty", () => {
    const { lastFrame } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        placeholder="Type here..."
      />,
    );

    const frame = lastFrame()!;
    expect(frame).toContain("Type here...");
  });

  it("types characters when active", async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(
      <TextArea isActive={true} onSubmit={onSubmit} />,
    );

    stdin.write("hello");

    // Wait for async useInput handling
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(lastFrame()).toContain("hello");
  });

  it("submits on Enter", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<TextArea isActive={true} onSubmit={onSubmit} />);

    stdin.write("test value");
    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onSubmit).toHaveBeenCalledWith("test value");
  });

  it("inserts newline on Ctrl+J", async () => {
    const { stdin, lastFrame } = render(
      <TextArea isActive={true} onSubmit={() => {}} />,
    );

    stdin.write("line1");
    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("\x0A"); // Ctrl+J
    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("line2");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame()!;
    expect(frame).toContain("line1");
    expect(frame).toContain("line2");
  });

  it("supports backspace", async () => {
    const { stdin, lastFrame } = render(
      <TextArea isActive={true} onSubmit={() => {}} />,
    );

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("\x7F"); // Backspace
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(lastFrame()).toContain("hell");
    expect(lastFrame()).not.toContain("hello");
  });

  it("does not accept input when inactive", () => {
    const { stdin, lastFrame } = render(
      <TextArea isActive={false} onSubmit={() => {}} />,
    );

    const before = lastFrame();
    stdin.write("hello");
    const after = lastFrame();

    expect(after).toBe(before);
  });

  it("renders line prefix when typing", async () => {
    const { stdin, lastFrame } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        linePrefix={({ lineNumber }) => (
          <Text color="green">{`>${lineNumber + 1}< `}</Text>
        )}
      />,
    );

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame()!;
    expect(frame).toContain(">1<");
    expect(frame).toContain("hello");
  });

  it("passes props object to linePrefix function", async () => {
    const linePrefix = vi.fn(() => <Text>{"> "}</Text>);
    const { stdin } = render(
      <TextArea isActive={true} onSubmit={() => {}} linePrefix={linePrefix} />,
    );

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(linePrefix).toHaveBeenCalled();
    const lastCall = linePrefix.mock.calls[linePrefix.mock.calls.length - 1];
    expect(lastCall).toHaveLength(1);
    const props = lastCall![0] as {
      lineNumber: number;
      totalLines: number;
      isActiveLine: boolean;
      isVirtualLine: boolean;
    };
    expect(typeof props.lineNumber).toBe("number");
    expect(typeof props.totalLines).toBe("number");
    expect(typeof props.isActiveLine).toBe("boolean");
    expect(typeof props.isVirtualLine).toBe("boolean");
  });

  it("highlights active line when highlightActiveLine is enabled", async () => {
    const { stdin, lastFrame } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        highlightActiveLine={true}
        activeLineColor="cyan"
      />,
    );

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(lastFrame()).toContain("hello");
  });

  it("renders LineNumber component", () => {
    const { lastFrame } = render(
      <LineNumber lineNumber={0} totalLines={10} isActive={false} />,
    );

    expect(lastFrame()).toContain(" 1");
  });

  it("renders active LineNumber with active color", () => {
    const { lastFrame } = render(
      <LineNumber
        lineNumber={0}
        totalLines={10}
        isActive={true}
        activeColor="red"
      />,
    );

    expect(lastFrame()).toContain(" 1");
  });

  describe("Controlled Mode", () => {
    it("renders controlled value", () => {
      const { lastFrame } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="controlled text"
          cursorPosition={[0, 17]} // At the end, so no ANSI in middle
          onChange={() => {}}
        />,
      );

      // Check for parts of text since cursor may add ANSI codes
      expect(lastFrame()).toContain("controlled");
      expect(lastFrame()).toContain("text");
    });

    it("calls onChange when typing in controlled mode", async () => {
      const onChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value=""
          onChange={onChange}
        />,
      );

      stdin.write("a");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onChange).toHaveBeenCalledWith("a");
    });

    it("respects cursorPosition prop", () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={[0, 3]}
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      // Move left to verify cursor starts at position 3
      stdin.write("\x1b[D"); // Left arrow

      // Verify onCursorChange is called with position 2 (moved left from 3)
      expect(onCursorChange).toHaveBeenCalledWith([0, 2]);
    });

    it("calls onCursorChange when cursor moves in controlled mode", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={[0, 5]}
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("\x1b[D"); // Left arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCursorChange).toHaveBeenCalledWith([0, 4]);
    });

    it("does not update internal state when value prop is provided", async () => {
      const onChange = vi.fn();
      const { stdin, lastFrame } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="fixed"
          cursorPosition={[0, 5]}
          onChange={onChange}
        />,
      );

      const beforeFrame = lastFrame();

      stdin.write("a");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Value should remain "fixed" because component is controlled
      const afterFrame = lastFrame();
      expect(afterFrame).toBe(beforeFrame);
      expect(onChange).toHaveBeenCalledWith("fixeda");
    });

    it("calls onChange with correct value when deleting in controlled mode", async () => {
      const onChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={[0, 5]}
          onChange={onChange}
        />,
      );

      stdin.write("\x7F"); // Backspace
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("calls onChange with correct value when inserting newline in controlled mode", async () => {
      const onChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="line1"
          cursorPosition={[0, 5]}
          onChange={onChange}
        />,
      );

      stdin.write("\x0A"); // Ctrl+J
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onChange).toHaveBeenCalledWith("line1\n");
    });

    it("clamps cursor to last line when line exceeds available lines", async () => {
      const onCursorChange = vi.fn();
      render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={[100, 0]} // Way beyond available lines
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should clamp to line 0 (the only line), column 5 (end of "hello")
      expect(onCursorChange).toHaveBeenCalledWith([0, 5]);
    });

    it("clamps cursor to last column when column exceeds line length", async () => {
      const onCursorChange = vi.fn();
      render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hi"
          cursorPosition={[0, 100]} // Way beyond line length
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should clamp to column 2 (length of "hi")
      expect(onCursorChange).toHaveBeenCalledWith([0, 2]);
    });

    it("clamps negative line to 0", async () => {
      const onCursorChange = vi.fn();
      render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={[-5, 2]} // Negative line
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should clamp to line 0, column 2
      expect(onCursorChange).toHaveBeenCalledWith([0, 2]);
    });

    it("clamps negative column to 0", async () => {
      const onCursorChange = vi.fn();
      render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={[0, -10]} // Negative column
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should clamp to column 0
      expect(onCursorChange).toHaveBeenCalledWith([0, 0]);
    });

    it("handles Infinity as line value", async () => {
      const onCursorChange = vi.fn();
      render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value={"line1\nline2\nline3"}
          cursorPosition={[Infinity, 0]}
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should clamp to last line (line 2), column 5 ("line3" length)
      expect(onCursorChange).toHaveBeenCalledWith([2, 5]);
    });

    it("handles Infinity as column value", async () => {
      const onCursorChange = vi.fn();
      render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="test"
          cursorPosition={[0, Infinity]}
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should clamp to column 4 (length of "test")
      expect(onCursorChange).toHaveBeenCalledWith([0, 4]);
    });

    it("correctly positions cursor on specific line in multi-line text", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value={"line1\nline2\nline3"}
          cursorPosition={[1, 3]} // Line 2, column 4
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Move right to verify position
      stdin.write("\x1b[C"); // Right arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have moved from column 3 to column 4 on line 1
      expect(onCursorChange).toHaveBeenLastCalledWith([1, 4]);
    });
  });

  describe("Navigation Lock", () => {
    it("moves cursor with arrow keys when enableArrowNavigation is true", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={[0, 0]}
          onChange={() => {}}
          onCursorChange={onCursorChange}
          enableArrowNavigation={true}
        />,
      );

      stdin.write("\x1b[C"); // Right arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCursorChange).toHaveBeenCalledWith([0, 1]);
    });

    it("does not move cursor with arrow keys when enableArrowNavigation is false", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={[0, 0]}
          onChange={() => {}}
          onCursorChange={onCursorChange}
          enableArrowNavigation={false}
        />,
      );

      stdin.write("\x1b[C"); // Right arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCursorChange).not.toHaveBeenCalled();
    });

    it("still allows typing when enableArrowNavigation is false", async () => {
      const onChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value=""
          onChange={onChange}
          enableArrowNavigation={false}
        />,
      );

      stdin.write("hello");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onChange).toHaveBeenCalledWith("hello");
    });

    it("still allows newline insertion when enableArrowNavigation is false", async () => {
      const onChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="line1"
          cursorPosition={[0, 5]}
          onChange={onChange}
          enableArrowNavigation={false}
        />,
      );

      stdin.write("\x0A"); // Ctrl+J
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onChange).toHaveBeenCalledWith("line1\n");
    });

    it("prevents all arrow directions when enableArrowNavigation is false", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello\nworld"
          cursorPosition={[1, 0]}
          onChange={() => {}}
          onCursorChange={onCursorChange}
          enableArrowNavigation={false}
        />,
      );

      // Wait for initial position report
      await new Promise((resolve) => setTimeout(resolve, 50));
      const initialCalls = onCursorChange.mock.calls.length;

      // Try all four directions
      stdin.write("\x1b[A"); // Up
      await new Promise((resolve) => setTimeout(resolve, 20));
      stdin.write("\x1b[B"); // Down
      await new Promise((resolve) => setTimeout(resolve, 20));
      stdin.write("\x1b[D"); // Left
      await new Promise((resolve) => setTimeout(resolve, 20));
      stdin.write("\x1b[C"); // Right
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Should only have initial call, no additional calls from arrows
      expect(onCursorChange).toHaveBeenCalledTimes(initialCalls);
    });
  });

  describe("Boundary Navigation Handlers", () => {
    it("calls onFirstLineUp when pressing up on first line", async () => {
      const onFirstLineUp = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={[0, 3]}
          onChange={() => {}}
          onFirstLineUp={onFirstLineUp}
        />,
      );

      stdin.write("\x1b[A"); // Up arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onFirstLineUp).toHaveBeenCalled();
    });

    it("calls onLastLineDown when pressing down after reaching max trailing empty lines with content", async () => {
      const onLastLineDown = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          placeholder="Type here..."
          onLastLineDown={onLastLineDown}
          autoNewLineLimit={2}
        />,
      );

      // Type some text first (required for autogrow to work)
      stdin.write("hello");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // First two Down presses create real newlines after content
      stdin.write("\x1b[B"); // Down arrow - creates first empty line
      await new Promise((resolve) => setTimeout(resolve, 100));
      stdin.write("\x1b[B"); // Down arrow - creates second empty line
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onLastLineDown).not.toHaveBeenCalled();

      // Third Down press should trigger onLastLineDown (max reached)
      stdin.write("\x1b[B"); // Down arrow
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onLastLineDown).toHaveBeenCalled();
    }, 10000);

    it("still allows normal up navigation when onFirstLineUp is not provided", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="line1\nline2"
          cursorPosition={[1, 2]} // On second line
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("\x1b[A"); // Up arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCursorChange).toHaveBeenCalled();
    });

    it("still allows normal down navigation when onLastLineDown is not provided", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="line1\nline2"
          cursorPosition={[0, 2]} // On first line
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("\x1b[B"); // Down arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCursorChange).toHaveBeenCalled();
    });
  });

  describe("Virtual Line Detection", () => {
    it("marks initial padding lines as virtual when no content exists", async () => {
      const linePrefix = vi.fn(() => <Text>{"> "}</Text>);
      render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          linePrefix={linePrefix}
          initialLineCount={4}
          placeholder="Line1\nLine2\nLine3\nLine4"
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 50));

      // First line should NOT be virtual (first line is always real)
      const line0Call = linePrefix.mock.calls.find(
        (call) => call[0].lineNumber === 0,
      );
      expect(line0Call).toBeDefined();
      expect(line0Call![0].isVirtualLine).toBe(false);

      // Lines 1-3 should be virtual (padding lines beyond actual content)
      for (let i = 1; i < 4; i++) {
        const lineCall = linePrefix.mock.calls.find(
          (call) => call[0].lineNumber === i,
        );
        expect(lineCall).toBeDefined();
        expect(lineCall![0].isVirtualLine).toBe(true);
      }
    });

    it("marks lines created by down navigation as real", async () => {
      const linePrefix = vi.fn(() => <Text>{"> "}</Text>);
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          linePrefix={linePrefix}
          initialLineCount={4}
        />,
      );

      // Type content first
      stdin.write("hello");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Clear previous calls
      linePrefix.mockClear();

      // Navigate down after content - this adds \n to value
      stdin.write("\x1b[B"); // Down arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      // The new line (line 1) should be real (\n was added)
      const calls = linePrefix.mock.calls;
      const line1Call = calls.find((call) => call[0].lineNumber === 1);
      expect(line1Call).toBeDefined();
      expect(line1Call![0].isVirtualLine).toBe(false);
    });

    it("marks lines with content as non-virtual", async () => {
      const linePrefix = vi.fn(() => <Text>{"> "}</Text>);
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          linePrefix={linePrefix}
          initialLineCount={4}
        />,
      );

      // Type on first line
      stdin.write("hello");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Clear calls from typing
      linePrefix.mockClear();

      // Insert newline and type on second line
      stdin.write("\x0A"); // Ctrl+J for newline
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("world");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Find line 1 call
      const line1Call = linePrefix.mock.calls.find(
        (call) => call[0].lineNumber === 1,
      );
      expect(line1Call).toBeDefined();
      expect(line1Call![0].isVirtualLine).toBe(false);
    });

    it("correctly identifies virtual vs real lines in mixed state", async () => {
      const linePrefix = vi.fn(() => <Text>{"> "}</Text>);
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          linePrefix={linePrefix}
          initialLineCount={6}
        />,
      );

      // Type on first line
      stdin.write("content");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Navigate down twice - after content, this creates REAL lines (adds \n)
      stdin.write("\x1b[B"); // Down
      await new Promise((resolve) => setTimeout(resolve, 100));
      stdin.write("\x1b[B"); // Down
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Clear calls
      linePrefix.mockClear();

      // Trigger a re-render by moving cursor
      stdin.write("\x1b[A"); // Up
      await new Promise((resolve) => setTimeout(resolve, 100));

      const calls = linePrefix.mock.calls;

      // Line 0 has content - not virtual
      const line0Call = calls.find((call) => call[0].lineNumber === 0);
      expect(line0Call![0].isVirtualLine).toBe(false);

      // Lines 1-2 were created by Down navigation AFTER content - they are real
      for (let i = 1; i <= 2; i++) {
        const lineCall = calls.find((call) => call[0].lineNumber === i);
        expect(lineCall).toBeDefined();
        expect(lineCall![0].isVirtualLine).toBe(false);
      }

      // Lines 3-5 are padding beyond value lines - virtual
      for (let i = 3; i < 6; i++) {
        const lineCall = calls.find((call) => call[0].lineNumber === i);
        expect(lineCall).toBeDefined();
        expect(lineCall![0].isVirtualLine).toBe(true);
      }
    }, 10000);
  });
});
