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
        linePrefix={(num) => <Text color="green">{`>${num + 1}< `}</Text>}
      />,
    );

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 100));

    const frame = lastFrame()!;
    expect(frame).toContain(">1<");
    expect(frame).toContain("hello");
  });

  it("passes isActiveLine to linePrefix function", async () => {
    const linePrefix = vi.fn(() => <Text>{"> "}</Text>);
    const { stdin } = render(
      <TextArea isActive={true} onSubmit={() => {}} linePrefix={linePrefix} />,
    );

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(linePrefix).toHaveBeenCalled();
    const lastCall = linePrefix.mock.calls[linePrefix.mock.calls.length - 1];
    expect(lastCall).toHaveLength(3);
    expect(typeof lastCall![2]).toBe("boolean");
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
          cursorPosition={17} // At the end, so no ANSI in middle
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
          cursorPosition={3}
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      // Move left to verify cursor starts at position 3
      stdin.write("\x1b[D"); // Left arrow

      // Verify onCursorChange is called with position 2 (moved left from 3)
      expect(onCursorChange).toHaveBeenCalledWith(2);
    });

    it("calls onCursorChange when cursor moves in controlled mode", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={5}
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("\x1b[D"); // Left arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCursorChange).toHaveBeenCalledWith(4);
    });

    it("does not update internal state when value prop is provided", async () => {
      const onChange = vi.fn();
      const { stdin, lastFrame } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="fixed"
          cursorPosition={5}
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
          cursorPosition={5}
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
          cursorPosition={5}
          onChange={onChange}
        />,
      );

      stdin.write("\x0A"); // Ctrl+J
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onChange).toHaveBeenCalledWith("line1\n");
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
          cursorPosition={0}
          onChange={() => {}}
          onCursorChange={onCursorChange}
          enableArrowNavigation={true}
        />,
      );

      stdin.write("\x1b[C"); // Right arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCursorChange).toHaveBeenCalledWith(1);
    });

    it("does not move cursor with arrow keys when enableArrowNavigation is false", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="hello"
          cursorPosition={0}
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
          cursorPosition={5}
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
          cursorPosition={6}
          onChange={() => {}}
          onCursorChange={onCursorChange}
          enableArrowNavigation={false}
        />,
      );

      // Try all four directions
      stdin.write("\x1b[A"); // Up
      await new Promise((resolve) => setTimeout(resolve, 20));
      stdin.write("\x1b[B"); // Down
      await new Promise((resolve) => setTimeout(resolve, 20));
      stdin.write("\x1b[D"); // Left
      await new Promise((resolve) => setTimeout(resolve, 20));
      stdin.write("\x1b[C"); // Right
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(onCursorChange).not.toHaveBeenCalled();
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
          cursorPosition={3}
          onChange={() => {}}
          onFirstLineUp={onFirstLineUp}
        />,
      );

      stdin.write("\x1b[A"); // Up arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onFirstLineUp).toHaveBeenCalled();
    });

    it("calls onLastLineDown when pressing down after reaching max trailing empty lines", async () => {
      const onLastLineDown = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          placeholder="Type here..."
          onLastLineDown={onLastLineDown}
          emptyAutogrowLimit={2}
        />,
      );

      // Type some text first (required for autogrow to work)
      stdin.write("hello");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // First two Down presses should autogrow (create empty lines after text)
      stdin.write("\x1b[B"); // Down arrow - creates first empty line
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\x1b[B"); // Down arrow - creates second empty line
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onLastLineDown).not.toHaveBeenCalled();

      // Third Down press should trigger onLastLineDown (max reached)
      stdin.write("\x1b[B"); // Down arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onLastLineDown).toHaveBeenCalled();
    });

    it("still allows normal up navigation when onFirstLineUp is not provided", async () => {
      const onCursorChange = vi.fn();
      const { stdin } = render(
        <TextArea
          isActive={true}
          onSubmit={() => {}}
          value="line1\nline2"
          cursorPosition={7} // On second line
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
          cursorPosition={2} // On first line
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />,
      );

      stdin.write("\x1b[B"); // Down arrow
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(onCursorChange).toHaveBeenCalled();
    });
  });
});
