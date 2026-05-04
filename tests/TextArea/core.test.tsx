import { describe, it, expect, vi } from "vitest";
import { render } from "ink-testing-library";
import { TextArea } from "../../src/index.js";
import type { TLinePrefixProps } from "../../src/index.js";
import { Text } from "ink";

describe("TextArea", () => {
  it("renders placeholder when empty and inactive", () => {
    const { lastFrame } = render(
      <TextArea
        focus={false}
        onSubmit={() => {}}
        placeholder="Type here..."
      />,
    );

    expect(lastFrame()).toContain("Type here...");
  });

  it("renders cursor when active and empty", () => {
    const { lastFrame } = render(
      <TextArea
        focus={true}
        onSubmit={() => {}}
        placeholder="Type here..."
      />,
    );

    // eslint-disable-next-line no-control-regex
    const stripped = (lastFrame() ?? "").replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Type here...");
  });

  it("types characters when active", async () => {
    const onSubmit = vi.fn();
    const { stdin, lastFrame } = render(
      <TextArea focus={true} onSubmit={onSubmit} />,
    );

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(lastFrame()).toContain("hello");
  });

  it("submits on Enter", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<TextArea focus={true} onSubmit={onSubmit} />);

    stdin.write("test value");
    await new Promise((resolve) => setTimeout(resolve, 50));

    stdin.write("\r");
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onSubmit).toHaveBeenCalledWith("test value");
  });

  it("inserts newline on Ctrl+J", async () => {
    const { stdin, lastFrame } = render(
      <TextArea focus={true} onSubmit={() => {}} />,
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
      <TextArea focus={true} onSubmit={() => {}} />,
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
      <TextArea focus={false} onSubmit={() => {}} />,
    );

    const before = lastFrame();
    stdin.write("hello");
    const after = lastFrame();

    expect(after).toBe(before);
  });

  it("renders line prefix when typing", async () => {
    const { stdin, lastFrame } = render(
      <TextArea
        focus={true}
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
      <TextArea focus={true} onSubmit={() => {}} linePrefix={linePrefix} />,
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
        focus={true}
        onSubmit={() => {}}
        highlightActiveLine={true}
        activeLineColor="cyan"
      />,
    );

    stdin.write("hello");
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(lastFrame()).toContain("hello");
  });
});
