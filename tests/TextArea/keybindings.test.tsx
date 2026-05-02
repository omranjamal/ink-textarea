import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { TextArea } from "../../src/index.js";

describe("TextArea > Keybindings", () => {
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

    const lastCall =
      onCursorChange.mock.calls[onCursorChange.mock.calls.length - 1]?.[0];
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

    stdin.write("\x01");
    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("\x05"); // Ctrl+E
    await new Promise((resolve) => setTimeout(resolve, 50));

    const lastCall =
      onCursorChange.mock.calls[onCursorChange.mock.calls.length - 1]?.[0];
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

    stdin.write("\x01");
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
    stdin.write("\x0A");
    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("cd");
    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("\x01"); // Ctrl+A → start of line 2
    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("\x1b[D"); // Left arrow → end of line 1
    await new Promise((resolve) => setTimeout(resolve, 50));
    stdin.write("\x0b"); // Ctrl+K
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

    stdin.write("\x1bb");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const lastCall =
      onCursorChange.mock.calls[onCursorChange.mock.calls.length - 1]?.[0];
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

    stdin.write("\x01");
    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("\x1bf");
    await new Promise((resolve) => setTimeout(resolve, 50));

    const lastCall =
      onCursorChange.mock.calls[onCursorChange.mock.calls.length - 1]?.[0];
    expect(lastCall).toEqual([0, 6]);
  });

  it("Tab without onTab does not modify value", async () => {
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
    onChange.mockClear();

    stdin.write("\t");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("Tab fires onTab callback with shift=false", async () => {
    const onTab = vi.fn();
    const { stdin } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        onTab={onTab}
      />,
    );

    stdin.write("\t");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onTab).toHaveBeenCalledTimes(1);
    expect(onTab).toHaveBeenCalledWith(false);
  });

  it("Shift+Tab fires onTab callback with shift=true", async () => {
    const onTab = vi.fn();
    const { stdin } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        onTab={onTab}
      />,
    );

    stdin.write("\x1b[Z");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onTab).toHaveBeenCalledTimes(1);
    expect(onTab).toHaveBeenCalledWith(true);
  });

  it("fires onFirstCharacterLeft when left arrow pressed at cursor 0", async () => {
    const onFirstCharacterLeft = vi.fn();
    const { stdin } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        value="abc"
        cursorPosition={[0, 0]}
        onChange={() => {}}
        onFirstCharacterLeft={onFirstCharacterLeft}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("\x1b[D");
    await new Promise((r) => setTimeout(r, 50));
    expect(onFirstCharacterLeft).toHaveBeenCalledTimes(1);
  });

  it("does not fire onFirstCharacterLeft when left arrow can move", async () => {
    const onFirstCharacterLeft = vi.fn();
    const { stdin } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        value="abc"
        cursorPosition={[0, 1]}
        onChange={() => {}}
        onFirstCharacterLeft={onFirstCharacterLeft}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("\x1b[D");
    await new Promise((r) => setTimeout(r, 50));
    expect(onFirstCharacterLeft).not.toHaveBeenCalled();
  });

  it("fires onLastCharacterRight when right arrow pressed at end of value", async () => {
    const onLastCharacterRight = vi.fn();
    const { stdin } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        value="abc"
        cursorPosition={[0, 3]}
        onChange={() => {}}
        onLastCharacterRight={onLastCharacterRight}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("\x1b[C");
    await new Promise((r) => setTimeout(r, 50));
    expect(onLastCharacterRight).toHaveBeenCalledTimes(1);
  });

  it("does not fire onLastCharacterRight when right arrow can move", async () => {
    const onLastCharacterRight = vi.fn();
    const { stdin } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        value="abc"
        cursorPosition={[0, 0]}
        onChange={() => {}}
        onLastCharacterRight={onLastCharacterRight}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("\x1b[C");
    await new Promise((r) => setTimeout(r, 50));
    expect(onLastCharacterRight).not.toHaveBeenCalled();
  });

  it("does not fire onFirstCharacterLeft on multi-line wrap to previous line", async () => {
    const onFirstCharacterLeft = vi.fn();
    const { stdin } = render(
      <TextArea
        isActive={true}
        onSubmit={() => {}}
        value={"ab\ncd"}
        cursorPosition={[1, 0]}
        onChange={() => {}}
        onFirstCharacterLeft={onFirstCharacterLeft}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("\x1b[D");
    await new Promise((r) => setTimeout(r, 50));
    expect(onFirstCharacterLeft).not.toHaveBeenCalled();
  });
});
