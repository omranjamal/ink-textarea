import { useInput, usePaste } from "ink";
import {
  countTrailingEmptyLines,
  findLineStart,
  findLineEnd,
  findPrevWordBoundary,
  findNextWordBoundary,
  getCursorLineAndColumn,
  computeVisualUpCursor,
  computeVisualDownCursor,
} from "../textUtils.js";

type UseKeyboardInputOptions = {
  isActive: boolean;
  value: string;
  cursor: number;
  enableArrowNavigation: boolean;
  autoNewLineLimit: number;
  onSubmit: (value: string) => void;
  onFirstLineUp: (() => void) | undefined;
  onLastLineDown: (() => void) | undefined;
  setValue: (updater: string | ((prev: string) => string)) => void;
  setCursor: (
    updater: number | ((prev: number) => number),
    valueForCalculation?: string,
  ) => void;
  pushUndo: (type: "insert" | "delete", value: string, cursor: number) => void;
  popUndo: () => { value: string; cursor: number } | undefined;
  resetMutationTracking: () => void;
  resetBlink: () => void;
  lineWidth: number;
};

export const useKeyboardInput = ({
  isActive,
  value,
  cursor,
  enableArrowNavigation,
  autoNewLineLimit,
  onSubmit,
  onFirstLineUp,
  onLastLineDown,
  setValue,
  setCursor,
  pushUndo,
  popUndo,
  resetMutationTracking,
  resetBlink,
  lineWidth,
}: UseKeyboardInputOptions): void => {
  usePaste(
    (text) => {
      const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (!normalized) return;
      resetBlink();
      pushUndo("insert", value, cursor);
      const newValue =
        value.slice(0, cursor) + normalized + value.slice(cursor);
      setValue(newValue);
      setCursor(cursor + normalized.length, newValue);
    },
    { isActive },
  );

  useInput(
    (input, key) => {
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
        pushUndo("insert", value, cursor);
        const newValue = value.slice(0, cursor) + "\n" + value.slice(cursor);
        setValue(newValue);
        setCursor(cursor + 1, newValue);
        return;
      }

      if (key.return) {
        onSubmit(value);
        return;
      }

      if (key.upArrow) {
        if (!enableArrowNavigation) return;
        const { line, column } = getCursorLineAndColumn(value, cursor);

        if (lineWidth > 0) {
          const visualRow = Math.floor(column / lineWidth);
          if (line === 0 && visualRow === 0) {
            if (onFirstLineUp) onFirstLineUp();
            return;
          }
          resetBlink();
          setCursor((c) => computeVisualUpCursor(value, c, lineWidth));
        } else {
          if (line === 0) {
            if (onFirstLineUp) onFirstLineUp();
            return;
          }
          resetBlink();
          setCursor((c) => {
            const { line: currentLine, column: col } = getCursorLineAndColumn(value, c);
            if (currentLine === 0) return findLineStart(value, c);
            const prevLineEnd = findLineStart(value, c) - 1;
            const prevLineStart = findLineStart(value, prevLineEnd);
            const prevLineLength = prevLineEnd - prevLineStart;
            return prevLineStart + Math.min(col, prevLineLength);
          });
        }
        return;
      }

      if (key.downArrow) {
        if (!enableArrowNavigation) return;
        resetBlink();

        if (lineWidth > 0) {
          const newPos = computeVisualDownCursor(value, cursor, lineWidth);
          if (newPos !== null) {
            setCursor(newPos);
          } else {
            const trailingEmpty = countTrailingEmptyLines(value);
            if (trailingEmpty >= autoNewLineLimit) {
              if (onLastLineDown) { onLastLineDown(); return; }
              setCursor(value.length);
              return;
            }
            pushUndo("insert", value, cursor);
            const newValue = value + "\n";
            setValue(newValue);
            setCursor(newValue.length, newValue);
          }
        } else {
          const currentLineEnd = findLineEnd(value, cursor);
          const isOnLastLine = currentLineEnd >= value.length;
          if (isOnLastLine) {
            const trailingEmpty = countTrailingEmptyLines(value);
            if (trailingEmpty >= autoNewLineLimit) {
              if (onLastLineDown) { onLastLineDown(); return; }
              setCursor(value.length);
              return;
            }
            pushUndo("insert", value, cursor);
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
        }
        return;
      }

      if (key.leftArrow) {
        if (!enableArrowNavigation) return;
        resetBlink();
        setCursor((c) => Math.max(0, c - 1));
        return;
      }

      if (key.rightArrow) {
        if (!enableArrowNavigation) return;
        resetBlink();
        setCursor((c) => Math.min(value.length, c + 1));
        return;
      }

      if (key.meta && input === "b") {
        resetBlink();
        setCursor((c) => findPrevWordBoundary(value, c));
        return;
      }

      if (key.meta && input === "f") {
        resetBlink();
        setCursor((c) => findNextWordBoundary(value, c));
        return;
      }

      if (key.ctrl && input === "a") {
        resetBlink();
        setCursor((c) => findLineStart(value, c));
        return;
      }

      if (key.ctrl && input === "e") {
        resetBlink();
        setCursor((c) => findLineEnd(value, c));
        return;
      }

      if (key.ctrl && input === "w") {
        resetBlink();
        pushUndo("delete", value, cursor);
        const boundary = findPrevWordBoundary(value, cursor);
        const newValue = value.slice(0, boundary) + value.slice(cursor);
        setValue(newValue);
        setCursor(boundary, newValue);
        return;
      }

      if (key.ctrl && input === "u") {
        resetBlink();
        pushUndo("delete", value, cursor);
        const lineStart = findLineStart(value, cursor);
        const newValue = value.slice(0, lineStart) + value.slice(cursor);
        setValue(newValue);
        setCursor(lineStart, newValue);
        return;
      }

      if (key.ctrl && input === "k") {
        resetBlink();
        pushUndo("delete", value, cursor);
        const lineEnd = findLineEnd(value, cursor);
        const newValue = value.slice(0, cursor) + value.slice(lineEnd);
        setValue(newValue);
        setCursor(cursor, newValue);
        return;
      }

      if (key.backspace || key.delete) {
        if (key.meta) {
          resetBlink();
          pushUndo("delete", value, cursor);
          const boundary = findPrevWordBoundary(value, cursor);
          const newValue = value.slice(0, boundary) + value.slice(cursor);
          setValue(newValue);
          setCursor(boundary, newValue);
          return;
        }
        if (cursor > 0) {
          resetBlink();
          pushUndo("delete", value, cursor);
          const newValue = value.slice(0, cursor - 1) + value.slice(cursor);
          setValue(newValue);
          setCursor(cursor - 1, newValue);
        }
        return;
      }

      if (key.ctrl && input === "z") {
        resetBlink();
        const entry = popUndo();
        if (entry) {
          setValue(entry.value);
          setCursor(entry.cursor);
        }
        resetMutationTracking();
        return;
      }

      if (key.ctrl || key.escape || key.tab) {
        return;
      }

      if (input && input.length > 0) {
        resetBlink();
        pushUndo("insert", value, cursor);
        const newValue = value.slice(0, cursor) + input + value.slice(cursor);
        setValue(newValue);
        setCursor(cursor + input.length, newValue);
      }
    },
    { isActive },
  );
};
