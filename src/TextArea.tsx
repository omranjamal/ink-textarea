import { Box, Text, useInput } from "ink";
import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";

const DEFAULT_CURSOR_INTERVAL = 500;
const DEFAULT_TYPING_PAUSE = 450;
const DEFAULT_MAX_UNDO = 128;
const DEFAULT_UNDO_GROUP_DELAY = 2500;
const DEFAULT_AUTO_NEW_LINE_LIMIT = 3;
const DEFAULT_INITIAL_LINE_COUNT = 2;

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

const getCursorFromLineColumn = (
  value: string,
  line: number,
  column: number,
): { cursor: number; clampedLine: number; clampedCol: number } => {
  const lines = value.split("\n");
  const numLines = lines.length;

  // Clamp line to valid range
  const clampedLine = Math.max(0, Math.min(line, numLines - 1));

  // If line was clamped due to exceeding available lines, go to last column
  // Otherwise clamp column to line length
  const targetLine = lines[clampedLine] ?? "";
  let clampedCol: number;
  if (line > numLines - 1) {
    // Line exceeded available lines, go to end of last line
    clampedCol = targetLine.length;
  } else {
    // Line is valid, clamp column normally
    clampedCol = Math.max(0, Math.min(column, targetLine.length));
  }

  // Calculate cursor position
  let cursor = 0;
  for (let i = 0; i < clampedLine; i++) {
    cursor += lines[i]!.length + 1; // +1 for newline
  }
  cursor += clampedCol;

  return { cursor, clampedLine, clampedCol };
};

export type TLinePrefixProps = {
  readonly lineNumber: number;
  readonly totalLines: number;
  readonly isActiveLine: boolean;
  readonly isVirtualLine: boolean;
};

type TLinePrefixFn = (props: TLinePrefixProps) => ReactNode;

export type TextAreaProps = {
  readonly isActive: boolean;
  readonly onSubmit: (value: string) => void;
  readonly placeholder?: string;
  readonly linePrefix?: ReactNode | TLinePrefixFn;
  readonly cursorInterval?: number;
  readonly typingPause?: number;
  readonly maxUndo?: number;
  readonly undoGroupDelay?: number;
  readonly autoNewLineLimit?: number;
  readonly highlightActiveLine?: boolean;
  readonly activeLineColor?: string;
  readonly enableArrowNavigation?: boolean;
  // Controlled mode props
  readonly value?: string;
  readonly cursorPosition?: [line: number, col: number];
  readonly onChange?: (value: string) => void;
  readonly onCursorChange?: (position: [line: number, col: number]) => void;
  // Boundary navigation handlers
  readonly onFirstLineUp?: () => void;
  readonly onLastLineDown?: () => void;
  // Initial line count
  readonly initialLineCount?: number;
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
  autoNewLineLimit = DEFAULT_AUTO_NEW_LINE_LIMIT,
  highlightActiveLine = false,
  activeLineColor = undefined,
  enableArrowNavigation = true,
  // Controlled mode
  value: controlledValue,
  cursorPosition: controlledPosition,
  onChange,
  onCursorChange,
  // Boundary navigation handlers
  onFirstLineUp,
  onLastLineDown,
  // Initial line count
  initialLineCount = DEFAULT_INITIAL_LINE_COUNT,
}: TextAreaProps): ReactNode => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState("");
  const [internalCursor, setInternalCursor] = useState(0);

  // Use ref to track latest value for synchronous access in setCursor
  const valueRef = useRef(isControlled ? controlledValue : internalValue);
  const value = isControlled ? controlledValue : internalValue;

  // Update ref when value changes
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Track last reported position to avoid duplicate callbacks
  const lastReportedPosition = useRef<[number, number] | null>(null);

  // Convert external [line, col] to internal cursor position
  const processExternalPosition = (): {
    cursor: number;
    clampedLine: number;
    clampedCol: number;
    wasClamped: boolean;
  } => {
    if (controlledPosition === undefined) {
      const { line, column } = getCursorLineAndColumn(value, internalCursor);
      return {
        cursor: internalCursor,
        clampedLine: line,
        clampedCol: column,
        wasClamped: false,
      };
    }
    const [line, col] = controlledPosition;
    const { cursor, clampedLine, clampedCol } = getCursorFromLineColumn(
      value,
      line,
      col,
    );
    const wasClamped = line !== clampedLine || col !== clampedCol;
    return { cursor, clampedLine, clampedCol, wasClamped };
  };

  const { cursor, clampedLine, clampedCol, wasClamped } =
    processExternalPosition();

  // Report clamped position if input was out of bounds
  useEffect(() => {
    if (wasClamped && onCursorChange) {
      const newPosition: [number, number] = [clampedLine, clampedCol];
      // Only report if different from last reported
      if (
        lastReportedPosition.current === null ||
        lastReportedPosition.current[0] !== newPosition[0] ||
        lastReportedPosition.current[1] !== newPosition[1]
      ) {
        lastReportedPosition.current = newPosition;
        onCursorChange(newPosition);
      }
    }
  }, [wasClamped, clampedLine, clampedCol, onCursorChange]);

  const setValue = (updater: string | ((prev: string) => string)) => {
    const newValue = typeof updater === "function" ? updater(value) : updater;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const setCursor = (
    updater: number | ((prev: number) => number),
    valueForCalculation?: string,
  ) => {
    const newCursor = typeof updater === "function" ? updater(cursor) : updater;
    if (!isControlled) {
      setInternalCursor(newCursor);
    }
    // Report cursor position as [line, col]
    if (onCursorChange) {
      // Use provided value for calculation (for when value changes simultaneously), otherwise use current value
      const valueToUse =
        valueForCalculation !== undefined
          ? valueForCalculation
          : valueRef.current;
      const { line, column } = getCursorLineAndColumn(valueToUse, newCursor);
      const newPosition: [number, number] = [line, column];
      // Only report if different from last reported
      if (
        lastReportedPosition.current === null ||
        lastReportedPosition.current[0] !== newPosition[0] ||
        lastReportedPosition.current[1] !== newPosition[1]
      ) {
        lastReportedPosition.current = newPosition;
        onCursorChange(newPosition);
      }
    }
  };
  const [cursorVisible, setCursorVisible] = useState(true);
  const blinkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Call onChange with initial value on first render in uncontrolled mode
  useEffect(() => {
    if (!isControlled && onChange) {
      onChange(internalValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Ctrl+J, Ctrl+Enter, Shift+Enter, or Alt+Enter — insert newline
      // Also handle kitty keyboard protocol escape sequences
      const isCtrlEnter =
        (key.return && key.ctrl) ||
        input === "\x1b[27;5;13~" ||
        input.endsWith("[27;5;13~");
      const isShiftEnter =
        (key.return && key.shift) ||
        input === "\x1b[27;2;13~" ||
        input.endsWith("[27;2;13~");
      const isAltEnter =
        (key.return && key.meta) ||
        input === "\x1b[27;3;13~" ||
        input.endsWith("[27;3;13~");
      if (
        (key.ctrl && input === "j") ||
        isCtrlEnter ||
        isShiftEnter ||
        isAltEnter
      ) {
        resetBlink();
        pushUndo("insert");
        const newValue = value.slice(0, cursor) + "\n" + value.slice(cursor);
        setValue(newValue);
        setCursor(cursor + 1, newValue);
        return;
      }

      // Enter — submit
      if (key.return) {
        onSubmit(value);
        return;
      }

      // Up arrow — move to same column on previous line
      if (key.upArrow) {
        if (!enableArrowNavigation) return;
        const { line } = getCursorLineAndColumn(value, cursor);
        if (line === 0 && onFirstLineUp) {
          onFirstLineUp();
          return;
        }
        resetBlink();
        setCursor((c) => {
          const { line: currentLine, column } = getCursorLineAndColumn(
            value,
            c,
          );
          if (currentLine === 0) {
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
        if (!enableArrowNavigation) return;
        const currentLineEnd = findLineEnd(value, cursor);
        const isOnLastLine = currentLineEnd >= value.length;
        resetBlink();
        if (isOnLastLine) {
          // Count trailing empty lines (lines with no content after them)
          const trailingEmpty = countTrailingEmptyLines(value);

          // Block if we'd exceed the limit of empty lines
          if (trailingEmpty >= autoNewLineLimit) {
            if (onLastLineDown) {
              onLastLineDown();
              return;
            }
            setCursor(value.length);
            return;
          }
          // On last line — insert a new line and move cursor there
          pushUndo("insert");
          const newValue = value + "\n";
          setValue(newValue);
          setCursor(newValue.length, newValue);
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
        if (!enableArrowNavigation) return;
        resetBlink();
        setCursor((c) => Math.max(0, c - 1));
        return;
      }

      // Right arrow
      if (key.rightArrow) {
        if (!enableArrowNavigation) return;
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
        const boundary = findPrevWordBoundary(value, cursor);
        const newValue = value.slice(0, boundary) + value.slice(cursor);
        setValue(newValue);
        setCursor(boundary, newValue);
        return;
      }

      // Ctrl+U — delete to start of current line
      if (key.ctrl && input === "u") {
        resetBlink();
        pushUndo("delete");
        const lineStart = findLineStart(value, cursor);
        const newValue = value.slice(0, lineStart) + value.slice(cursor);
        setValue(newValue);
        setCursor(lineStart, newValue);
        return;
      }

      // Ctrl+K — delete to end of current line
      if (key.ctrl && input === "k") {
        resetBlink();
        pushUndo("delete");
        const lineEnd = findLineEnd(value, cursor);
        const newValue = value.slice(0, cursor) + value.slice(lineEnd);
        setValue(newValue);
        setCursor(cursor, newValue);
        return;
      }

      // Backspace (with Opt+Backspace for word deletion)
      if (key.backspace || key.delete) {
        if (key.meta) {
          // Opt+Delete — delete word before cursor
          resetBlink();
          pushUndo("delete");
          const boundary = findPrevWordBoundary(value, cursor);
          const newValue = value.slice(0, boundary) + value.slice(cursor);
          setValue(newValue);
          setCursor(boundary, newValue);
          return;
        }
        if (cursor > 0) {
          resetBlink();
          pushUndo("delete");
          const newValue = value.slice(0, cursor - 1) + value.slice(cursor);
          setValue(newValue);
          setCursor(cursor - 1, newValue);
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
        const newValue = value.slice(0, cursor) + input + value.slice(cursor);
        setValue(newValue);
        setCursor(cursor + input.length, newValue);
      }
    },
    { isActive },
  );

  // Multi-line rendering (minimum initialLineCount visible lines)
  const lines = value.split("\n");
  const totalLines = Math.max(lines.length, initialLineCount);
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
    isVirtualLine: boolean,
  ): ReactNode => {
    const isActiveLine = isActive && lineNumber === cursorLine;
    const prefixProps: TLinePrefixProps = {
      lineNumber,
      totalLines: totalLinesArg,
      isActiveLine,
      isVirtualLine,
    };
    const prefix =
      typeof linePrefix === "function" ? linePrefix(prefixProps) : linePrefix;

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

  // Split placeholder by newlines for multiline support
  const placeholderLines = placeholder ? placeholder.split("\n") : [];

  // Render placeholder when empty and not focused
  if (value.length === 0 && !isActive && placeholderLines.length > 0) {
    return (
      <Box flexDirection="column">
        {Array.from({ length: initialLineCount }, (_, i) =>
          renderLine(
            <Text dimColor>{placeholderLines[i] ?? " "}</Text>,
            i,
            i,
            initialLineCount,
            i > 0,
          ),
        )}
      </Box>
    );
  }

  // Render placeholder with cursor when empty and focused
  if (value.length === 0 && isActive) {
    return (
      <Box flexDirection="column">
        {Array.from({ length: initialLineCount }, (_, i) =>
          renderLine(
            <Text>
              {i === cursorLine && cursorVisible ? "\x1b[7m \x1b[27m" : " "}
              {placeholderLines[i] ? (
                <Text dimColor>{placeholderLines[i]}</Text>
              ) : null}
            </Text>,
            i,
            i,
            initialLineCount,
            i > 0, // First line (i=0) is never virtual, only lines beyond that
          ),
        )}
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
        false,
      );
    }

    const before = lineText.slice(0, cursorColumn);
    const atCursor = lineText[cursorColumn] ?? " ";
    const after = lineText.slice(cursorColumn + 1);

    return renderLine(
      <Text>
        {before}
        {cursorVisible
          ? `\x1b[7m${atCursor}\x1b[27m`
          : atCursor === " " && cursorColumn >= lineText.length
            ? " "
            : atCursor}
        {after}
        {lineIdx === 0 && !hasContent && placeholder ? (
          <Text dimColor>{placeholder}</Text>
        ) : null}
      </Text>,
      lineIdx,
      lineIdx,
      totalLines,
      false,
    );
  });

  // Pad to minimum initialLineCount lines so the input visually signals multi-line
  while (renderedLines.length < initialLineCount) {
    const padIdx = renderedLines.length;
    renderedLines.push(
      renderLine(<Text> </Text>, `pad-${padIdx}`, padIdx, totalLines, true),
    );
  }

  return <Box flexDirection="column">{renderedLines}</Box>;
};
