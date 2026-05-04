import { render, Box, Text } from "ink";
import { useState, useMemo } from "react";
import { TextArea, LineNumberPrefix, type TLabels } from "ink-textarea";

const SLASH_COMMANDS = new Set(["/train", "/track", "/transfer", "/transact", "/help", "/quit"]);

const PLACEHOLDER = `
It obviously supports multi-line
placeholders. 

With highlighting too like: /help
or: @john
`.trim()

const App = () => {
  const [submitted, setSubmitted] = useState("");
  const [boundaryMessage, setBoundaryMessage] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [cursorPos, setCursorPos] = useState<[number, number]>([0, 0]);
  const [lineWidth, setLineWidth] = useState(0);
  const [chunkType, setChunkType] = useState<string>("text");
  const [chunkIdx, setChunkIdx] = useState<number>(0);
  const [activeBox, setActiveBox] = useState<0 | 1>(0);

  const labels = useMemo<TLabels>(
    () => [
      {
        pattern: /\/[a-zA-Z]+/g,
        label: (m) => (SLASH_COMMANDS.has(m[0]) ? "slashCommand" : undefined),
      },
      {
        pattern: /@[a-zA-Z]{3,}/g,
        label: 'mention',
      },
    ],
    [],
  );
  const styles = useMemo(
    () => ({ slashCommand: { color: "#ff8800" }, mention: {color: "blue", bold: true} }),
    [],
  );

  const showBoundaryMessage = (message: string) => {
    setBoundaryMessage(message);
    setTimeout(() => {
      setBoundaryMessage(null);
    }, 500);
  };

  return (
    <Box flexDirection="column" gap={1} paddingY={1} paddingX={6}>
      <Box flexDirection="column" width={64} borderStyle="single" paddingY={1} paddingX={3} borderDimColor borderColor={activeBox === 0 ? 'cyan' : 'gray'}>
        <Box flexDirection="row" gap={2} marginBottom={1}>
          <Text bold dimColor>DEMO 1 {activeBox === 0 ? '(focused)' : '(Tab to focus)'}</Text>
        </Box>
        <TextArea
          focus={activeBox === 0}
          onSubmit={setSubmitted}
          placeholder={PLACEHOLDER}
          autoNewLineLimit={4}
          viewportLines={10}
          initialLineCount={5}
          showInvisibles={true}
          onTab={() => setActiveBox(1)}
          onFirstLineUp={() => showBoundaryMessage("[first line up]")}
          onLastLineDown={() => showBoundaryMessage("[last line down]")}
          onFirstCharacterLeft={() =>
            showBoundaryMessage("[first character left]")
          }
          onLastCharacterRight={() =>
            showBoundaryMessage("[last character right]")
          }
          onChange={(value) => setCharCount(value.length)}
          onCursorChange={(pos, type, idx) => {
            setCursorPos(pos);
            setChunkType(type);
            setChunkIdx(idx);
          }}
          onDimensions={setLineWidth}
          labels={labels}
          styles={styles}
          linePrefix={LineNumberPrefix}
        />
      </Box>

      <Box flexDirection="column" width={64} borderStyle="single" paddingY={1} paddingX={3} borderDimColor borderColor={activeBox === 1 ? 'cyan' : 'gray'}>
        <Box flexDirection="row" gap={2} marginBottom={1}>
          <Text bold dimColor>DEMO 2 {activeBox === 1 ? '(focused)' : '(Tab to focus)'}</Text>
        </Box>
        <TextArea
          focus={activeBox === 1}
          onSubmit={setSubmitted}
          placeholder="Second textarea — Tab cycles back."
          autoNewLineLimit={2}
          initialLineCount={3}
          onTab={() => setActiveBox(0)}
          labels={labels}
          styles={styles}
          linePrefix={({ isActiveLine }) => (
            <Text color={isActiveLine ? 'cyan' : 'gray'}>│ </Text>
          )}
        />
      </Box>

      <Box paddingX={2} flexDirection="row" gap={2}>
        <Text dimColor>
          {charCount} chars | Line {cursorPos[0] + 1}, Col {cursorPos[1] + 1} | CURRENT={chunkType} ({chunkIdx}) | W={lineWidth}
        </Text>

        {boundaryMessage && (
          <Text color="cyan" bold>
            {boundaryMessage}
          </Text>
        )}
      </Box>
    </Box>
  );
};

render(<App />);
