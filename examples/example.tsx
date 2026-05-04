import { render, Box, Text } from "ink";
import { useState, useMemo, useRef, type ReactNode } from "react";
import {
  TextArea,
  LineNumberPrefix,
  type TLabels,
  type TextAreaProps,
} from "ink-textarea";

const SLASH_COMMANDS = new Set(["/train", "/track", "/transfer", "/transact", "/help", "/quit"]);

const PLACEHOLDER = `
It obviously supports multi-line
placeholders.

With highlighting too like: /help
or: @john
`.trim()

type DemoBoxProps = {
  readonly title: string;
  readonly active: boolean;
  readonly textAreaProps: Omit<
    TextAreaProps,
    | "focus"
    | "onChange"
    | "onCursorChange"
    | "onDimensions"
    | "onFirstLineUp"
    | "onLastLineDown"
    | "onFirstCharacterLeft"
    | "onLastCharacterRight"
  >;
};

const DemoBox = ({ title, active, textAreaProps }: DemoBoxProps): ReactNode => {
  const [charCount, setCharCount] = useState(0);
  const [cursorPos, setCursorPos] = useState<[number, number]>([0, 0]);
  const [lineWidth, setLineWidth] = useState(0);
  const [chunkType, setChunkType] = useState<string>("text");
  const [chunkIdx, setChunkIdx] = useState<number>(0);
  const [boundary, setBoundary] = useState<string | null>(null);
  const boundaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashBoundary = (arrow: string) => {
    setBoundary(arrow);
    if (boundaryTimer.current) clearTimeout(boundaryTimer.current);
    boundaryTimer.current = setTimeout(() => setBoundary(null), 500);
  };

  return (
    <Box flexDirection="column">
      <Box
        flexDirection="column"
        width={64}
        borderStyle="single"
        paddingY={1}
        paddingX={3}
        borderDimColor
        borderColor={active ? "cyan" : "gray"}
      >
        <Box flexDirection="row" gap={2} marginBottom={1}>
          <Text bold dimColor>
            {title} {active ? "(focused)" : "(Tab to focus)"}
          </Text>
        </Box>
        <TextArea
          {...textAreaProps}
          focus={active}
          onChange={(value) => setCharCount(value.length)}
          onCursorChange={(pos, type, idx) => {
            setCursorPos(pos);
            setChunkType(type);
            setChunkIdx(idx);
          }}
          onDimensions={setLineWidth}
          onFirstLineUp={() => flashBoundary("↑")}
          onLastLineDown={() => flashBoundary("↓")}
          onFirstCharacterLeft={() => flashBoundary("←")}
          onLastCharacterRight={() => flashBoundary("→")}
        />
      </Box>
      <Box paddingX={2} flexDirection="row" gap={2} height={1}>
        {active ? (
          <Text>
            {charCount} chars | Line {cursorPos[0] + 1}, Col {cursorPos[1] + 1}{" "}
            | CURRENT={chunkType} ({chunkIdx}) | W={lineWidth}
            {boundary ? (
              <Text color="cyan" bold>
                {" | "}
                {boundary}
              </Text>
            ) : null}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
};

const App = () => {
  const [, setSubmitted] = useState("");
  const [activeBox, setActiveBox] = useState<0 | 1>(0);

  const labels = useMemo<TLabels>(
    () => [
      {
        pattern: /\/[a-zA-Z]+/g,
        label: (m) => (SLASH_COMMANDS.has(m[0]) ? "slashCommand" : undefined),
      },
      {
        pattern: /@[a-zA-Z]{3,}/g,
        label: "mention",
      },
    ],
    [],
  );
  const styles = useMemo(
    () => ({
      slashCommand: { color: "#ff8800" },
      mention: { color: "blue", bold: true },
    }),
    [],
  );

  return (
    <Box flexDirection="column" gap={1} paddingY={1} paddingX={6}>
      <DemoBox
        title="DEMO 1"
        active={activeBox === 0}
        textAreaProps={{
          onSubmit: setSubmitted,
          placeholder: PLACEHOLDER,
          autoNewLineLimit: 4,
          viewportLines: 10,
          initialLineCount: 5,
          showInvisibles: true,
          onTab: () => setActiveBox(1),
          labels,
          styles,
          linePrefix: LineNumberPrefix,
        }}
      />

      <DemoBox
        title="DEMO 2"
        active={activeBox === 1}
        textAreaProps={{
          onSubmit: setSubmitted,
          placeholder: "Second textarea — Tab cycles back.",
          autoNewLineLimit: 0,
          viewportLines: 5,
          initialLineCount: 3,
          onTab: () => setActiveBox(0),
          labels,
          styles,
          linePrefix: ({ isActiveLine }) => (
            <Text color={isActiveLine ? "cyan" : "gray"}>│ </Text>
          ),
        }}
      />
    </Box>
  );
};

render(<App />);
