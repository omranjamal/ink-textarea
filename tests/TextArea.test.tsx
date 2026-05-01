import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { TextArea, LineNumber } from "../src/index.js";
import type { TLinePrefixProps } from "../src/index.js";
import { Text } from "ink";

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
    const linePrefix = vi.fn((_props: TLinePrefixProps) => <Text>{"> "}</Text>);
    const { stdin } = render(
      <TextArea isActive={true} onSubmit={() => {}} linePrefix={linePrefix} />,
    );

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(linePrefix).toHaveBeenCalled();
    const lastCall = linePrefix.mock.calls[linePrefix.mock.calls.length - 1];
    expect(lastCall).toHaveLength(1);
    const props = lastCall![0];
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
      const linePrefix = vi.fn((_props: TLinePrefixProps) => <Text>{"> "}</Text>);
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
      const linePrefix = vi.fn((_props: TLinePrefixProps) => <Text>{"> "}</Text>);
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
      const linePrefix = vi.fn((_props: TLinePrefixProps) => <Text>{"> "}</Text>);
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
      const linePrefix = vi.fn((_props: TLinePrefixProps) => <Text>{"> "}</Text>);
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

  describe("Undo/Redo", () => {
    it("Ctrl+Z reverts last character", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} undoGroupDelay={0} />,
      );

      stdin.write("a");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("b");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain("ab");

      stdin.write("\x1a"); // Ctrl+Z
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain("a");
      expect(lastFrame()).not.toContain("ab");
    });

    it("Ctrl+Z is no-op with empty stack", async () => {
      const onChange = vi.fn();
      const { stdin } = render(
        <TextArea isActive={true} onSubmit={() => {}} onChange={onChange} />,
      );

      onChange.mockClear();

      stdin.write("\x1a"); // Ctrl+Z on empty stack
      await new Promise((resolve) => setTimeout(resolve, 100));

      // onChange not called (nothing to undo)
      expect(onChange).not.toHaveBeenCalled();
    });

    it("multiple undos restore each prior state", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} undoGroupDelay={0} />,
      );

      stdin.write("a");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("b");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("c");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x1a"); // Ctrl+Z → "ab"
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\x1a"); // Ctrl+Z → "a"
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\x1a"); // Ctrl+Z → ""
      await new Promise((resolve) => setTimeout(resolve, 50));

      // All content removed
      expect(lastFrame()).not.toMatch(/[abc]/);
    });

    it("maxUndo=1 keeps only one undo entry", async () => {
      const { stdin, lastFrame } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          maxUndo={1}
          undoGroupDelay={0}
        />,
      );

      stdin.write("a");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("b");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("c");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x1a"); // Ctrl+Z
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\x1a"); // Ctrl+Z again — stack empty, no-op
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have only restored one step; 'a' or 'ab' visible
      const frame = lastFrame()!;
      expect(frame).not.toContain("abc");
    });

    it("undo groups inserts with undoGroupDelay=0 as separate entries", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} undoGroupDelay={0} />,
      );

      stdin.write("x");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("y");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x1a"); // Ctrl+Z → removes 'y'
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain("x");
      expect(lastFrame()).not.toContain("y");
    });
  });

  describe("Keybindings", () => {
    it("Ctrl+A moves cursor to start of line", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("hello");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x01"); // Ctrl+A
      await new Promise((resolve) => setTimeout(resolve, 50));

      const lastCall = onCursorChange.mock.calls[onCursorChange.mock.calls.length - 1]?.[0];
      expect(lastCall).toEqual([0, 0]);
    });

    it("Ctrl+E moves cursor to end of line", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("hello");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x01"); // Ctrl+A first (go to start)
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x05"); // Ctrl+E
      await new Promise((resolve) => setTimeout(resolve, 50));

      const lastCall = onCursorChange.mock.calls[onCursorChange.mock.calls.length - 1]?.[0];
      expect(lastCall).toEqual([0, 5]);
    });

    it("Ctrl+W deletes word before cursor", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} />,
      );

      stdin.write("hello world");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x17"); // Ctrl+W
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain("hello ");
      expect(lastFrame()).not.toContain("world");
    });

    it("Ctrl+U deletes to start of current line", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} />,
      );

      stdin.write("hello world");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x15"); // Ctrl+U
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).not.toContain("hello");
      expect(lastFrame()).not.toContain("world");
    });

    it("Ctrl+K deletes to end of line", async () => {
      const onCursorChange = vi.fn();
      const { stdin, lastFrame } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("hello world");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x01"); // Ctrl+A — go to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x0b"); // Ctrl+K
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).not.toContain("hello");
      expect(lastFrame()).not.toContain("world");
    });

    it("Ctrl+K at end of line joins next line", async () => {
      const onChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onChange={onChange}
        />,
      );

      stdin.write("ab");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\x0A"); // newline → "ab\n"
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("cd");
      await new Promise((resolve) => setTimeout(resolve, 50));
      // value: "ab\ncd", cursor at end (5)
      stdin.write("\x01"); // Ctrl+A → start of line 2 (cursor=3)
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\x1b[D"); // Left arrow → cursor=2 (end of line 1)
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\x0b"); // Ctrl+K → consume newline + nothing else? cursor at lineEnd, lineEnd char is '\n' → kill it
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onChange).toHaveBeenLastCalledWith("abcd");
    });

    it("Opt+Left jumps to previous word boundary", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("hello world");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x1bb"); // Opt+Left (meta+b)
      await new Promise((resolve) => setTimeout(resolve, 50));

      const lastCall = onCursorChange.mock.calls[onCursorChange.mock.calls.length - 1]?.[0];
      // cursor should be at col 6 (start of 'world')
      expect(lastCall).toEqual([0, 6]);
    });

    it("Opt+Right jumps to next word boundary", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("hello world");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x01"); // Ctrl+A — go to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x1bf"); // Opt+Right (meta+f)
      await new Promise((resolve) => setTimeout(resolve, 50));

      const lastCall = onCursorChange.mock.calls[onCursorChange.mock.calls.length - 1]?.[0];
      // findNextWordBoundary skips 'hello' and the space, lands at 'world' (col 6)
      expect(lastCall).toEqual([0, 6]);
    });
  });

  describe("Submit edge cases", () => {
    it("Enter with empty text calls onSubmit with empty string", async () => {
      const onSubmit = vi.fn();
      const { stdin } = render(
        <TextArea isActive={true} onSubmit={onSubmit} />,
      );

      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onSubmit).toHaveBeenCalledWith("");
    });

    it("Enter with multiline text passes full value including newlines", async () => {
      const onSubmit = vi.fn();
      const { stdin } = render(
        <TextArea isActive={true} onSubmit={onSubmit} />,
      );

      stdin.write("line1");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\x0A"); // Ctrl+J
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("line2");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onSubmit).toHaveBeenCalledWith("line1\nline2");
    });
  });

  describe("autoNewLineLimit edge cases", () => {
    it("autoNewLineLimit=0 never creates trailing empty lines via down arrow", async () => {
      const onLastLineDown = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          autoNewLineLimit={0}
          onLastLineDown={onLastLineDown}
        />,
      );

      stdin.write("\x1b[B"); // Down
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onLastLineDown).toHaveBeenCalled();
    });

    it("autoNewLineLimit=1 allows exactly one trailing empty line", async () => {
      const onLastLineDown = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          autoNewLineLimit={1}
          onLastLineDown={onLastLineDown}
          initialLineCount={1}
        />,
      );

      stdin.write("text");
      await new Promise((resolve) => setTimeout(resolve, 50));

      stdin.write("\x1b[B"); // Down — creates one empty line
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onLastLineDown).not.toHaveBeenCalled();

      stdin.write("\x1b[B"); // Down again — hits limit
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onLastLineDown).toHaveBeenCalled();
    });
  });

  describe("onDimensions", () => {
    it("accepts onDimensions prop without error", async () => {
      const onDimensions = vi.fn();
      const { stdin, lastFrame } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onDimensions={onDimensions}
        />,
      );

      stdin.write("hello");
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Component renders correctly regardless of measurement environment
      expect(lastFrame()).toContain("hello");
    });

    it("onDimensions fires once on initial measurement before any input", async () => {
      const onDimensions = vi.fn();
      render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onDimensions={onDimensions}
        />,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onDimensions).toHaveBeenCalled();
      const width = onDimensions.mock.calls[0]![0];
      expect(width).toBeGreaterThan(0);
    });
  });

  describe("Character-level chunking", () => {
    it("renders text correctly when lineWidth is 0 (before measurement)", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} />,
      );

      stdin.write("hello world");
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(lastFrame()).toContain("hello");
      expect(lastFrame()).toContain("world");
    });

    it("renders multiline text with correct line count", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} />,
      );

      stdin.write("line1");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\x0A"); // Ctrl+J
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("line2");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).toContain("line1");
      expect(lastFrame()).toContain("line2");
    });
  });

  describe("LineNumber always shows number", () => {
    it("renders number when inactive", () => {
      const { lastFrame } = render(
        <LineNumber lineNumber={0} totalLines={10} isActive={false} />,
      );
      expect(lastFrame()).toContain("1");
    });

    it("renders number when active", () => {
      const { lastFrame } = render(
        <LineNumber lineNumber={4} totalLines={10} isActive={true} />,
      );
      expect(lastFrame()).toContain("5");
    });

    it("pads number to match totalLines digit width", () => {
      const { lastFrame } = render(
        <LineNumber lineNumber={0} totalLines={100} isActive={false} />,
      );
      // Should be padded to 3 digits: "  1"
      expect(lastFrame()).toContain("  1");
    });
  });

  describe("Placeholder multiline", () => {
    it("renders each line of a multiline placeholder", () => {
      const { lastFrame } = render(
        <TextArea
          isActive={false}
          onSubmit={() => {}}
          placeholder={"line one\nline two"}
          initialLineCount={2}
        />,
      );

      const frame = lastFrame()!;
      expect(frame).toContain("line one");
      expect(frame).toContain("line two");
    });

    it("placeholder disappears when text is typed", async () => {
      const { stdin, lastFrame } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          placeholder="Type here..."
        />,
      );

      stdin.write("x");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(lastFrame()).not.toContain("Type here...");
    });
  });

  describe("Multi-line paste", () => {
    const PASTE_START = "[200~";
    const PASTE_END = "[201~";

    it("inserts pasted multi-line text with \\n separators", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} />,
      );

      stdin.write(`${PASTE_START}line1\nline2\nline3${PASTE_END}`);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame()!;
      expect(frame).toContain("line1");
      expect(frame).toContain("line2");
      expect(frame).toContain("line3");
    });

    it("normalizes \\r\\n (CRLF) line endings on paste", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} />,
      );

      stdin.write(`${PASTE_START}line1\r\nline2\r\nline3${PASTE_END}`);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame()!;
      expect(frame).toContain("line1");
      expect(frame).toContain("line2");
      expect(frame).toContain("line3");
      expect(frame).not.toContain("\r");
    });

    it("normalizes bare \\r (CR) line endings on paste", async () => {
      const { stdin, lastFrame } = render(
        <TextArea isActive={true} onSubmit={() => {}} />,
      );

      stdin.write(`${PASTE_START}line1\rline2\rline3${PASTE_END}`);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame()!;
      expect(frame).toContain("line1");
      expect(frame).toContain("line2");
      expect(frame).toContain("line3");
      expect(frame).not.toContain("\r");
    });

    it("places cursor at end of pasted block", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write(`${PASTE_START}a\nbb\nccc${PASTE_END}`);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCursorChange).toHaveBeenCalled();
      const lastCall =
        onCursorChange.mock.calls[onCursorChange.mock.calls.length - 1]![0];
      expect(lastCall).toEqual([2, 3]);
    });

    it("undoes a multi-line paste in a single step", async () => {
      const onChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          onChange={onChange}
        />,
      );

      stdin.write(`${PASTE_START}line1\nline2\nline3${PASTE_END}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(onChange).toHaveBeenLastCalledWith("line1\nline2\nline3");

      stdin.write("\x1A"); // Ctrl+Z
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onChange).toHaveBeenLastCalledWith("");
    });
  });
});
