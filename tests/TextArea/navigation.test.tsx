import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { TextArea } from "../../src/index.js";
import { waitFor } from "../_util/wait.js";

describe("TextArea > Navigation Lock", () => {
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

    expect(onCursorChange).toHaveBeenCalledWith(
      [0, 1],
      expect.any(String),
      expect.any(Number),
    );
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

    await new Promise((resolve) => setTimeout(resolve, 50));
    const initialCalls = onCursorChange.mock.calls.length;

    stdin.write("\x1b[A");
    await new Promise((resolve) => setTimeout(resolve, 20));
    stdin.write("\x1b[B");
    await new Promise((resolve) => setTimeout(resolve, 20));
    stdin.write("\x1b[D");
    await new Promise((resolve) => setTimeout(resolve, 20));
    stdin.write("\x1b[C");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onCursorChange).toHaveBeenCalledTimes(initialCalls);
  });
});

describe("TextArea > Boundary Navigation Handlers", () => {
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

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 100));

    stdin.write("\x1b[B");
    await new Promise((resolve) => setTimeout(resolve, 100));
    stdin.write("\x1b[B");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(onLastLineDown).not.toHaveBeenCalled();

    stdin.write("\x1b[B");
    await waitFor(() => onLastLineDown.mock.calls.length > 0);

    expect(onLastLineDown).toHaveBeenCalled();
  }, 10000);

  it("still allows normal up navigation when onFirstLineUp is not provided", async () => {
    const onCursorChange = vi.fn();
    const { stdin } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        value="line1\nline2"
        cursorPosition={[1, 2]}
        onChange={() => {}}
        onCursorChange={onCursorChange}
      />,
    );

    stdin.write("\x1b[A");
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
        cursorPosition={[0, 2]}
        onChange={() => {}}
        onCursorChange={onCursorChange}
      />,
    );

    stdin.write("\x1b[B");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onCursorChange).toHaveBeenCalled();
  });
});
