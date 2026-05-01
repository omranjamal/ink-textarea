import { Box, Text, useInput } from "ink";
import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";

const DEFAULT_CURSOR_INTERVAL = 500;
const DEFAULT_TYPING_PAUSE = 450;
const DEFAULT_MAX_UNDO = 128;
const DEFAULT_UNDO_GROUP_DELAY = 2500;
const DEFAULT_MAX_TRAILING_EMPTY_LINES = 3;

const countTrailingEmptyLines = (text: string): number => {
  let count = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    if (text[i] === "\n") {
      count++;
    } else {
      break;
    }
  }
  return count;
};

type TUndoEntry = { readonly value: string; readonly cursor: number };
type TMutationType = "insert" | "delete";

const findLineStart = (value: string, cursor: number): number => {
  if (cursor <= 0) return 0;
  const idx = value.lastIndexOf("\n", cursor - 1);
  return idx === -1 ? 0 : idx + 1;
};

const findLineEnd = (value: string, cursor: number): number => {
  const idx = value.indexOf("\n", cursor);
  return idx === -1 ? value.length : idx;
};

const findPrevWordBoundary = (value: string, cursor: number): number => {
  const lineStart = findLineStart(value, cursor);
  let pos = cursor - 1;
  while (pos > lineStart && /\s/.test(value[pos]!) && value[pos] !== "\n") {
    pos -= 1;
  }
  while (pos > lineStart && !/\s/.test(value[pos - 1]!)) {
    pos -= 1;
  }
  return Math.max(lineStart, pos);
};

const findNextWordBoundary = (value: string, cursor: number): number => {
  const lineEnd = findLineEnd(value, cursor);
  let pos = cursor;
  while (pos < lineEnd && !/\s/.test(value[pos]!)) {
    pos += 1;
  }
  while (pos < lineEnd && /\s/.test(value[pos]!) && value[pos] !== "\n") {
    pos += 1;
  }
  return Math.min(lineEnd, pos);
};

const getCursorLineAndColumn = (
  value: string,
  cursor: number,
): { line: number; column: number } => {
  let line = 0;
  let lastLineStart = 0;
  for (let i = 0; i < cursor; i++) {
    if (value[i] === "\n") {
      line += 1;
      lastLineStart = i + 1;
    }
  }
  return { line, column: cursor - lastLineStart };
};

type TLinePrefixFn = (
  lineNumber: number,
  totalLines: number,
  isActiveLine: boolean,
) => ReactNode;

export type CursorStyle = "block" | "line" | "underscore";

export type TextAreaProps = {
  readonly isActive: boolean;
  readonly onSubmit: (value: string) => void;
  readonly placeholder?: string;
  readonly linePrefix?: ReactNode | TLinePrefixFn;
  readonly cursorInterval?: number;
  readonly typingPause?: number;
  readonly maxUndo?: number;
  readonly undoGroupDelay?: number;
  readonly maxTrailingEmptyLines?: number;
  readonly highlightActiveLine?: boolean;
  readonly activeLineColor?: string;
  readonly cursorStyle?: CursorStyle;
};

const getCursorChar = (style: CursorStyle): string => {
  switch (style) {
    case "line":
      return "│";
    case "underscore":
      return "_";
    case "block":
    default:
      return "█";
  }
};

export const TextArea = ({
  isActive,
  onSubmit,
  placeholder,
  linePrefix,
  cursorInterval = DEFAULT_CURSOR_INTERVAL,
  typingPause = DEFAULT_TYPING_PAUSE,
  maxUndo = DEFAULT_MAX_UNDO,
  undoGroupDelay = DEFAULT_UNDO_GROUP_DELAY,
  maxTrailingEmptyLines = DEFAULT_MAX_TRAILING_EMPTY_LINES,
  highlightActiveLine = false,
  activeLineColor = undefined,
  cursorStyle = "block",
}: TextAreaProps): ReactNode => {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive) {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    blinkIntervalRef.current = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, cursorInterval);

    return () => {
      if (blinkIntervalRef.current) {
        clearInterval(blinkIntervalRef.current);
        blinkIntervalRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [isActive]);

  const undoStack = useRef<TUndoEntry[]>([]);
  const lastMutationTime = useRef(0);
  const lastMutationType = useRef<TMutationType | null>(null);

  const resetBlink = () => {
    setCursorVisible(true);

    if (blinkIntervalRef.current) {
      clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      blinkIntervalRef.current = setInterval(() => {
        setCursorVisible((prev) => !prev);
      }, cursorInterval);
    }, typingPause);
  };

  const pushUndo = (type: TMutationType) => {
    const now = Date.now();
    const elapsed = now - lastMutationTime.current;
    const sameType = type === lastMutationType.current;

    lastMutationTime.current = now;
    lastMutationType.current = type;

    if (elapsed < undoGroupDelay && sameType) {
      return;
    }

    const stack = undoStack.current;
    if (stack.length >= maxUndo) {
      stack.shift();
    }
    stack.push({ value, cursor });
  };

  useInput(
    (input, key) => {
      // Ctrl+J, Ctrl+Enter, or Shift+Enter — insert newline
      // Also handle kitty keyboard protocol escape sequences
      const isCtrlEnter =
        (key.return && key.ctrl) ||
        input === "\x1b[27;5;13~" ||
        input.endsWith("[27;5;13~");
      const isShiftEnter =
        (key.return && key.shift) ||
        input === "\x1b[27;2;13~" ||
        input.endsWith("[27;2;13~");
      if ((key.ctrl && input === "j") || isCtrlEnter || isShiftEnter) {
        resetBlink();
        if (
          cursor >= value.length &&
          countTrailingEmptyLines(value) >= maxTrailingEmptyLines
        ) {
          return;
        }
        pushUndo("insert");
        setValue((v) => v.slice(0, cursor) + "\n" + v.slice(cursor));
        setCursor((c) => c + 1);
        return;
      }

      // Enter — submit
      if (key.return) {
        onSubmit(value);
        return;
      }

      // Up arrow — move to same column on previous line
      if (key.upArrow) {
        resetBlink();
        setCursor((c) => {
          const { line, column } = getCursorLineAndColumn(value, c);
          if (line === 0) {
            return findLineStart(value, c);
          }
          const prevLineEnd = findLineStart(value, c) - 1;
          const prevLineStart = findLineStart(value, prevLineEnd);
          const prevLineLength = prevLineEnd - prevLineStart;
          return prevLineStart + Math.min(column, prevLineLength);
        });
        return;
      }

      // Down arrow — move to next line, or create one if on last line
      if (key.downArrow) {
        resetBlink();
        const currentLineEnd = findLineEnd(value, cursor);
        if (currentLineEnd >= value.length) {
          if (countTrailingEmptyLines(value) >= maxTrailingEmptyLines) {
            setCursor(value.length);
            return;
          }
          // On last line — insert a new line and move cursor there
          pushUndo("insert");
          setValue((v) => v + "\n");
          setCursor(value.length + 1);
        } else {
          setCursor((c) => {
            const { column } = getCursorLineAndColumn(value, c);
            const nextLineStart = currentLineEnd + 1;
            const nextLineEnd = findLineEnd(value, nextLineStart);
            const nextLineLength = nextLineEnd - nextLineStart;
            return nextLineStart + Math.min(column, nextLineLength);
          });
        }
        return;
      }

      // Left arrow
      if (key.leftArrow) {
        resetBlink();
        setCursor((c) => Math.max(0, c - 1));
        return;
      }

      // Right arrow
      if (key.rightArrow) {
        resetBlink();
        setCursor((c) => Math.min(value.length, c + 1));
        return;
      }

      // Opt+Left (meta+b) — word jump backward
      if (key.meta && input === "b") {
        resetBlink();
        setCursor((c) => findPrevWordBoundary(value, c));
        return;
      }

      // Opt+Right (meta+f) — word jump forward
      if (key.meta && input === "f") {
        resetBlink();
        setCursor((c) => findNextWordBoundary(value, c));
        return;
      }

      // Ctrl+A — start of current line
      if (key.ctrl && input === "a") {
        resetBlink();
        setCursor((c) => findLineStart(value, c));
        return;
      }

      // Ctrl+E — end of current line
      if (key.ctrl && input === "e") {
        resetBlink();
        setCursor((c) => findLineEnd(value, c));
        return;
      }

      // Ctrl+W — delete word before cursor
      if (key.ctrl && input === "w") {
        resetBlink();
        pushUndo("delete");
        setCursor((c) => {
          const boundary = findPrevWordBoundary(value, c);
          setValue((v) => v.slice(0, boundary) + v.slice(c));
          return boundary;
        });
        return;
      }

      // Ctrl+U — delete to start of current line
      if (key.ctrl && input === "u") {
        resetBlink();
        pushUndo("delete");
        setCursor((c) => {
          const lineStart = findLineStart(value, c);
          setValue((v) => v.slice(0, lineStart) + v.slice(c));
          return lineStart;
        });
        return;
      }

      // Ctrl+K — delete to end of current line
      if (key.ctrl && input === "k") {
        resetBlink();
        pushUndo("delete");
        setCursor((c) => {
          const lineEnd = findLineEnd(value, c);
          setValue((v) => v.slice(0, c) + v.slice(lineEnd));
          return c;
        });
        return;
      }

      // Backspace (with Opt+Backspace for word deletion)
      if (key.backspace || key.delete) {
        if (key.meta) {
          // Opt+Delete — delete word before cursor
          resetBlink();
          pushUndo("delete");
          const boundary = findPrevWordBoundary(value, cursor);
          setValue((v) => v.slice(0, boundary) + v.slice(cursor));
          setCursor(boundary);
          return;
        }
        if (cursor > 0) {
          resetBlink();
          pushUndo("delete");
          setValue((v) => v.slice(0, cursor - 1) + v.slice(cursor));
          setCursor((c) => c - 1);
        }
        return;
      }

      // Ctrl+Z — undo
      if (key.ctrl && input === "z") {
        resetBlink();
        const entry = undoStack.current.pop();
        if (entry) {
          setValue(entry.value);
          setCursor(entry.cursor);
        }
        lastMutationTime.current = 0;
        lastMutationType.current = null;
        return;
      }

      // Ignore other control/meta/escape/tab keys
      if (key.ctrl || key.escape || key.tab) {
        return;
      }

      // Regular character input
      if (input && input.length > 0) {
        resetBlink();
        pushUndo("insert");
        setValue((v) => v.slice(0, cursor) + input + v.slice(cursor));
        setCursor((c) => c + input.length);
      }
    },
    { isActive },
  );

  // Multi-line rendering (minimum 2 visible lines)
  const lines = value.split("\n");
  const totalLines = Math.max(lines.length, 2);
  const hasContent = value.replace(/\n/g, "").length > 0;
  const { line: cursorLine, column: cursorColumn } = getCursorLineAndColumn(
    value,
    cursor,
  );

  const renderLine = (
    content: ReactNode,
    key: string | number,
    lineNumber: number,
    totalLinesArg: number,
  ): ReactNode => {
    const isActiveLine = isActive && lineNumber === cursorLine;
    const prefix =
      typeof linePrefix === "function"
        ? linePrefix(lineNumber, totalLinesArg, isActiveLine)
        : linePrefix;

    const isHighlighted = highlightActiveLine && isActiveLine;

    return prefix ? (
      <Box
        key={key}
        width="100%"
        backgroundColor={isHighlighted ? activeLineColor : undefined}
      >
        {prefix}
        {content}
      </Box>
    ) : (
      <Box
        key={key}
        width="100%"
        backgroundColor={isHighlighted ? activeLineColor : undefined}
      >
        {content}
      </Box>
    );
  };

  // Render placeholder when empty and not focused
  if (value.length === 0 && !isActive && placeholder) {
    return (
      <Box flexDirection="column">
        {renderLine(<Text dimColor>{placeholder}</Text>, 0, 0, 2)}
        {renderLine(<Text> </Text>, 1, 1, 2)}
      </Box>
    );
  }

  // Render placeholder with cursor when empty and focused
  if (value.length === 0 && isActive) {
    const cursorChar = getCursorChar(cursorStyle);
    return (
      <Box flexDirection="column">
        {renderLine(
          <Text>
            {cursorVisible ? <Text inverse>{cursorChar}</Text> : " "}
            {placeholder ? <Text dimColor>{placeholder}</Text> : null}
          </Text>,
          0,
          0,
          2,
        )}
        {renderLine(<Text> </Text>, 1, 1, 2)}
      </Box>
    );
  }

  const renderedLines = lines.map((lineText, lineIdx) => {
    const isCursorLine = lineIdx === cursorLine;

    if (!isCursorLine || !isActive) {
      return renderLine(
        <Text>
          {lineText || " "}
          {lineIdx === 0 && !hasContent && placeholder ? (
            <Text dimColor>{placeholder}</Text>
          ) : null}
        </Text>,
        lineIdx,
        lineIdx,
        totalLines,
      );
    }

    const before = lineText.slice(0, cursorColumn);
    const atCursor = lineText[cursorColumn] ?? " ";
    const after = lineText.slice(cursorColumn + 1);
    const cursorChar = getCursorChar(cursorStyle);

    return renderLine(
      <Text>
        {before}
        {cursorVisible ? (
          cursorStyle === "block" ? (
            <Text inverse>{atCursor === " " ? cursorChar : atCursor}</Text>
          ) : (
            <Text inverse>{cursorChar}</Text>
          )
        ) : atCursor === " " && cursorColumn >= lineText.length ? (
          " "
        ) : (
          atCursor
        )}
        {after}
        {lineIdx === 0 && !hasContent && placeholder ? (
          <Text dimColor>{placeholder}</Text>
        ) : null}
      </Text>,
      lineIdx,
      lineIdx,
      totalLines,
    );
  });

  // Pad to minimum 2 lines so the input visually signals multi-line
  while (renderedLines.length < 2) {
    const padIdx = renderedLines.length;
    renderedLines.push(
      renderLine(<Text> </Text>, `pad-${padIdx}`, padIdx, totalLines),
    );
  }

  return <Box flexDirection="column">{renderedLines}</Box>;
};
