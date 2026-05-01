import { render, Box, Text } from "ink";
import { useState, useEffect } from "react";
import React from "react";
import { TextArea, LineNumber } from "ink-textarea";

const App = () => {
  const [submitted, setSubmitted] = useState("");
  const [boundaryMessage, setBoundaryMessage] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [cursorPos, setCursorPos] = useState<[number, number]>([0, 0]);
  const [lineWidth, setLineWidth] = useState(0);

  const showBoundaryMessage = (message: string) => {
    setBoundaryMessage(message);
    setTimeout(() => {
      setBoundaryMessage(null);
    }, 500);
  };

  return (
    <Box flexDirection="column" gap={1} padding={2} width={64}>
      <Text bold>TextArea with Line Prefix</Text>
      <Text dimColor>
        This example shows line numbers and a border. Try pressing ↑ on first
        line or ↓ on last line!
      </Text>

      <TextArea
        isActive={true}
        onSubmit={setSubmitted}
        placeholder={`Write some code...
Use arrow keys to navigate

Ctrl+Enter for new line`}
        autoNewLineLimit={4}
        initialLineCount={4}
        onFirstLineUp={() => showBoundaryMessage("[first line up]")}
        onLastLineDown={() => showBoundaryMessage("[last line down]")}
        onChange={(value) => setCharCount(value.length)}
        onCursorChange={setCursorPos}
        onDimensions={setLineWidth}
        linePrefix={({
          lineNumber,
          totalLines,
          isActiveLine,
          isVirtualLine,
          isContinuationLine,
        }) => {
          const numWidth = String(totalLines).length;
          const numText = isContinuationLine
            ? "|".padStart(numWidth, " ")
            : String(lineNumber + 1).padStart(numWidth, " ");
          return (
            <Text>
              <Text color={isActiveLine ? "magenta" : "gray"}>│ </Text>
              <Text
                color={
                  isVirtualLine || isContinuationLine
                    ? "gray"
                    : isActiveLine
                      ? "magenta"
                      : "white"
                }
              >
                {numText}
              </Text>
              <Text color={isActiveLine ? "magenta" : "gray"}> │ </Text>
            </Text>
          );
        }}
      />

      <Text dimColor>
        {charCount} characters | Line {cursorPos[0] + 1}, Col {cursorPos[1] + 1} | Width {lineWidth}
      </Text>

      {boundaryMessage && (
        <Text color="cyan" bold>
          {boundaryMessage}
        </Text>
      )}

      {submitted && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="green">You wrote:</Text>
          {submitted.split("\n").map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

render(<App />);
