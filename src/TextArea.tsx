import { Box, Text, useBoxMetrics } from "ink";
import type { DOMElement } from "ink";
import { useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_CURSOR_INTERVAL,
  DEFAULT_TYPING_PAUSE,
  DEFAULT_MAX_UNDO,
  DEFAULT_UNDO_GROUP_DELAY,
  DEFAULT_AUTO_NEW_LINE_LIMIT,
  DEFAULT_INITIAL_LINE_COUNT,
} from "./constants.js";
import {
  getCursorLineAndColumn,
  chunkString,
  chunkLineForCursor,
  renderChunkWithCursor,
} from "./textUtils.js";
import { useCursorState } from "./hooks/useCursorState.js";
import { useUndo } from "./hooks/useUndo.js";
import { useCursorBlink } from "./hooks/useCursorBlink.js";
import { useKeyboardInput } from "./hooks/useKeyboardInput.js";
import type { TextAreaProps, TLinePrefixProps } from "./types.js";

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
  value: controlledValue,
  cursorPosition: controlledPosition,
  onChange,
  onCursorChange,
  onFirstLineUp,
  onLastLineDown,
  initialLineCount = DEFAULT_INITIAL_LINE_COUNT,
  onDimensions,
}: TextAreaProps): ReactNode => {
  const { value, cursor, setValue, setCursor } = useCursorState({
    controlledValue,
    controlledPosition,
    onChange,
    onCursorChange,
  });

  const lines = value.split("\n");

  const contentRef = useRef<DOMElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { width: measuredWidth } = useBoxMetrics(contentRef as any);
  const [lineWidth, setLineWidth] = useState(0);

  useEffect(() => {
    if (measuredWidth > 0) {
      setLineWidth((prev) => (prev === measuredWidth ? prev : measuredWidth));
    }
  }, [measuredWidth]);

  useEffect(() => {
    if (measuredWidth > 0) {
      onDimensions?.(measuredWidth);
    }
  }, [measuredWidth, onDimensions]);

  const { pushUndo, popUndo, resetMutationTracking } = useUndo({
    maxUndo,
    undoGroupDelay,
  });

  const { cursorVisible, resetBlink } = useCursorBlink({
    isActive,
    cursorInterval,
    typingPause,
  });

  useKeyboardInput({
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
  });

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
    ref: { current: DOMElement | null } | undefined,
    isContinuationLine: boolean,
    continuationIndex: number,
    isActiveLine: boolean,
  ): ReactNode => {
    const prefixProps: TLinePrefixProps = {
      lineNumber,
      totalLines: totalLinesArg,
      isActiveLine,
      isVirtualLine,
      isContinuationLine,
      continuationIndex,
    };
    const prefix =
      typeof linePrefix === "function" ? linePrefix(prefixProps) : linePrefix;

    const isHighlighted = highlightActiveLine && isActiveLine;

    return prefix ? (
      <Box
        key={key}
        width="100%"
        flexDirection="row"
        backgroundColor={isHighlighted ? activeLineColor : undefined}
      >
        <Box flexShrink={0}>{prefix}</Box>
        <Box ref={ref} flexGrow={1}>
          {content}
        </Box>
      </Box>
    ) : (
      <Box
        key={key}
        width="100%"
        backgroundColor={isHighlighted ? activeLineColor : undefined}
      >
        <Box ref={ref} flexGrow={1}>
          {content}
        </Box>
      </Box>
    );
  };

  const placeholderLines = placeholder ? placeholder.split("\n") : [];

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
            i === 0 ? contentRef : undefined,
            false,
            0,
            false,
          ),
        )}
      </Box>
    );
  }

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
            i > 0,
            i === 0 ? contentRef : undefined,
            false,
            0,
            isActive && i === cursorLine,
          ),
        )}
      </Box>
    );
  }

  const linesToRender = !hasContent
    ? Math.max(lines.length, initialLineCount)
    : lines.length;

  const renderedLines: ReactNode[] = [];

  for (let lineIdx = 0; lineIdx < linesToRender; lineIdx++) {
    const lineText = lines[lineIdx] ?? "";
    const isVirtualLine = lineIdx >= lines.length;
    const isCursorLine = isActive && lineIdx === cursorLine;

    let chunks: string[];
    if (lineWidth > 0) {
      chunks = isCursorLine
        ? chunkLineForCursor(lineText, cursorColumn, lineWidth)
        : lineText.length > 0
          ? chunkString(lineText, lineWidth)
          : [""];
    } else {
      chunks = [lineText];
    }

    const cursorVisualRow =
      isCursorLine && lineWidth > 0 ? Math.floor(cursorColumn / lineWidth) : 0;

    for (let c = 0; c < chunks.length; c++) {
      const chunk = chunks[c]!;
      const isContinuation = c > 0;
      const isActiveRow = isCursorLine && c === cursorVisualRow;

      let bodyText: string;
      if (isActiveRow) {
        const posInChunk =
          lineWidth > 0 ? cursorColumn % lineWidth : cursorColumn;
        bodyText = renderChunkWithCursor(
          chunk,
          posInChunk,
          cursorVisible,
          cursorColumn >= lineText.length,
        );
      } else {
        bodyText = chunk || " ";
      }

      const showPlaceholder =
        !isContinuation && placeholderLines[lineIdx] && !hasContent;

      renderedLines.push(
        renderLine(
          <Text>
            {bodyText}
            {showPlaceholder ? (
              <Text dimColor>{placeholderLines[lineIdx]}</Text>
            ) : null}
          </Text>,
          `${lineIdx}-${c}`,
          lineIdx,
          totalLines,
          isVirtualLine,
          lineIdx === 0 && c === 0 ? contentRef : undefined,
          isContinuation,
          c,
          isActiveRow,
        ),
      );
    }
  }

  for (let padIdx = linesToRender; padIdx < initialLineCount; padIdx++) {
    renderedLines.push(
      renderLine(
        <Text>
          {placeholderLines[padIdx] && !hasContent ? (
            <Text dimColor>{placeholderLines[padIdx]}</Text>
          ) : (
            " "
          )}
        </Text>,
        `pad-${padIdx}`,
        padIdx,
        totalLines,
        true,
        undefined,
        false,
        0,
        false,
      ),
    );
  }

  return <Box flexDirection="column">{renderedLines}</Box>;
};
