import { Box, Text, useBoxMetrics } from "ink";
import type { DOMElement } from "ink";
import { useRef, useState, useEffect, useMemo } from "react";
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
  computeLabels,
  computeSegments,
  getLabelAt,
  findSegmentIndex,
} from "./textUtils.js";
import { useCursorState } from "./hooks/useCursorState.js";
import { useUndo } from "./hooks/useUndo.js";
import { useCursorBlink } from "./hooks/useCursorBlink.js";
import { useKeyboardInput } from "./hooks/useKeyboardInput.js";
import type {
  TextAreaProps,
  TLinePrefixProps,
  TStyleProps,
  TStyles,
} from "./types.js";

type InvisiblesConfig = {
  readonly space: boolean;
  readonly tab: boolean;
  readonly newline: boolean;
};

type ResolvedStyles = {
  text: TStyleProps;
  invisibleCharacter: TStyleProps;
  byLabel: Record<string, TStyleProps>;
};

const DEFAULT_TEXT_STYLE: TStyleProps = {};
const DEFAULT_INVISIBLE_STYLE: TStyleProps = { color: "gray", dim: true };

const mergeStyleProps = (
  base: TStyleProps,
  override: TStyleProps | undefined,
): TStyleProps => ({ ...base, ...(override ?? {}) });

const resolveStyles = (input: TStyles | undefined): ResolvedStyles => {
  const byLabel: Record<string, TStyleProps> = {};
  if (input) {
    for (const [k, v] of Object.entries(input)) {
      if (k === "text" || k === "invisibleCharacter" || !v) continue;
      byLabel[k] = { ...v };
    }
  }
  return {
    text: mergeStyleProps(DEFAULT_TEXT_STYLE, input?.text),
    invisibleCharacter: mergeStyleProps(
      DEFAULT_INVISIBLE_STYLE,
      input?.invisibleCharacter,
    ),
    byLabel,
  };
};

const styleToTextProps = (s: TStyleProps) => ({
  color: s.color,
  bold: s.bold,
  italic: s.italic,
  underline: s.underline,
  strikethrough: s.strikethrough,
  dimColor: s.dim,
  inverse: s.inverse,
  backgroundColor: s.bgColor,
});

type RenderChunkBodyArgs = {
  chunk: string;
  chunkAbsStart: number;
  cursorPos: number;
  cursorVisible: boolean;
  isCursorAtLineEnd: boolean;
  inv: InvisiblesConfig;
  showAnyInvisible: boolean;
  invisibleProps: ReturnType<typeof styleToTextProps>;
  labelByChar: string[];
  labelTextProps: Record<string, ReturnType<typeof styleToTextProps>>;
};

const renderChunkBody = ({
  chunk,
  chunkAbsStart,
  cursorPos,
  cursorVisible,
  isCursorAtLineEnd,
  inv,
  showAnyInvisible,
  invisibleProps,
  labelByChar,
  labelTextProps,
}: RenderChunkBodyArgs): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let buf = "";
  let bufLabel: string | null = null;
  let segIdx = 0;
  const flush = () => {
    if (buf.length > 0) {
      const lp = bufLabel !== null ? labelTextProps[bufLabel] : undefined;
      nodes.push(
        <Text key={`s${segIdx++}`} {...lp}>
          {buf}
        </Text>,
      );
      buf = "";
      bufLabel = null;
    }
  };

  for (let i = 0; i < chunk.length; i++) {
    const ch = chunk[i]!;
    const charLabel = labelByChar[chunkAbsStart + i] ?? "text";
    const glyph =
      showAnyInvisible &&
      ((ch === " " && inv.space) || (ch === "\t" && inv.tab))
        ? ch === " "
          ? "·"
          : "→"
        : null;
    const isCursor = i === cursorPos;

    if (isCursor) {
      flush();
      const display = glyph ?? ch;
      const cursorStr = cursorVisible
        ? `\x1b[7m${display}\x1b[27m`
        : display === " " && isCursorAtLineEnd
          ? " "
          : display;
      if (glyph !== null) {
        nodes.push(
          <Text key={`c${i}`} {...invisibleProps}>
            {cursorStr}
          </Text>,
        );
      } else {
        const lp = labelTextProps[charLabel];
        nodes.push(
          <Text key={`c${i}`} {...lp}>
            {cursorStr}
          </Text>,
        );
      }
    } else if (glyph !== null) {
      flush();
      nodes.push(
        <Text key={`d${i}`} {...invisibleProps}>
          {glyph}
        </Text>,
      );
    } else {
      if (bufLabel !== null && bufLabel !== charLabel) {
        flush();
      }
      buf += ch;
      bufLabel = charLabel;
    }
  }
  flush();

  if (cursorPos === chunk.length) {
    const cursorStr = cursorVisible ? `\x1b[7m \x1b[27m` : " ";
    nodes.push(<Text key="cend">{cursorStr}</Text>);
  }

  return nodes;
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
  value: controlledValue,
  cursorPosition: controlledPosition,
  onChange,
  onCursorChange,
  onFirstLineUp,
  onLastLineDown,
  initialLineCount = DEFAULT_INITIAL_LINE_COUNT,
  onDimensions,
  showInvisibles = false,
  styles,
  labels,
}: TextAreaProps): ReactNode => {
  const resolvedStyles = useMemo(() => resolveStyles(styles), [styles]);
  const textProps = useMemo(
    () => styleToTextProps(resolvedStyles.text),
    [resolvedStyles.text],
  );
  const invisibleProps = useMemo(
    () => styleToTextProps(resolvedStyles.invisibleCharacter),
    [resolvedStyles.invisibleCharacter],
  );
  const labelTextProps = useMemo(() => {
    const out: Record<string, ReturnType<typeof styleToTextProps>> = {};
    for (const [k, v] of Object.entries(resolvedStyles.byLabel)) {
      out[k] = styleToTextProps(v);
    }
    return out;
  }, [resolvedStyles.byLabel]);
  const inv =
    typeof showInvisibles === "boolean"
      ? {
          space: showInvisibles,
          tab: showInvisibles,
          newline: showInvisibles,
        }
      : {
          space: !!showInvisibles.space,
          tab: !!showInvisibles.tab,
          newline: !!showInvisibles.newline,
        };
  const showAnyInvisible = inv.space || inv.tab || inv.newline;
  const dispatchCursorRef = useRef<
    ((cursor: number, valueForCalc?: string) => void) | null
  >(null);

  const { value, cursor, setValue, setCursor } = useCursorState({
    controlledValue,
    controlledPosition,
    onChange,
    onCursorAttempt: (newCursor, valueForCalc) => {
      dispatchCursorRef.current?.(newCursor, valueForCalc);
    },
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
  const hasContent = value.length > 0;
  const { line: cursorLine, column: cursorColumn } = getCursorLineAndColumn(
    value,
    cursor,
  );

  const labelByChar = useMemo(
    () => computeLabels(value, labels ?? {}),
    [value, labels],
  );
  const segments = useMemo(() => computeSegments(labelByChar), [labelByChar]);

  const placeholderLabelByChar = useMemo(
    () => computeLabels(placeholder ?? "", labels ?? {}),
    [placeholder, labels],
  );

  const renderPlaceholderLine = (
    lineText: string,
    absStart: number,
    keyPrefix: string,
  ): ReactNode[] => {
    if (lineText.length === 0) {
      return [
        <Text key={`${keyPrefix}-empty`} {...textProps} dimColor>
          {" "}
        </Text>,
      ];
    }
    const nodes: ReactNode[] = [];
    let buf = "";
    let bufLabel: string | null = null;
    let segCounter = 0;
    const flush = () => {
      if (buf.length > 0) {
        const lp =
          bufLabel !== null && bufLabel !== "text"
            ? labelTextProps[bufLabel]
            : undefined;
        nodes.push(
          <Text
            key={`${keyPrefix}-${segCounter++}`}
            {...textProps}
            {...lp}
            dimColor
          >
            {buf}
          </Text>,
        );
        buf = "";
        bufLabel = null;
      }
    };
    for (let i = 0; i < lineText.length; i++) {
      const charLabel = placeholderLabelByChar[absStart + i] ?? "text";
      if (bufLabel !== null && bufLabel !== charLabel) flush();
      buf += lineText[i];
      bufLabel = charLabel;
    }
    flush();
    return nodes;
  };

  const placeholderLineStartOffsets: number[] = [];
  {
    let off = 0;
    const phLines = placeholder ? placeholder.split("\n") : [];
    for (let i = 0; i < phLines.length; i++) {
      placeholderLineStartOffsets.push(off);
      off += phLines[i]!.length + 1;
    }
  }

  const lastDispatchRef = useRef<{
    line: number;
    col: number;
    type: string;
    idx: number;
  } | null>(null);
  const prevCursorRef = useRef<number>(cursor);

  const dispatchCursor = (
    targetCursor: number,
    valueForCalc?: string,
  ): void => {
    if (!onCursorChange) return;
    const v = valueForCalc ?? value;
    const { line, column } = getCursorLineAndColumn(v, targetCursor);
    const type =
      targetCursor === 0 ? "text" : getLabelAt(labelByChar, targetCursor - 1);
    const idx =
      targetCursor === 0 ? 0 : findSegmentIndex(segments, targetCursor - 1);
    const last = lastDispatchRef.current;
    if (
      last !== null &&
      last.line === line &&
      last.col === column &&
      last.type === type &&
      last.idx === idx
    ) {
      return;
    }
    lastDispatchRef.current = { line, col: column, type, idx };
    onCursorChange([line, column], type, idx);
  };

  dispatchCursorRef.current = dispatchCursor;

  useEffect(() => {
    if (prevCursorRef.current !== cursor) {
      dispatchCursor(cursor);
    }
    prevCursorRef.current = cursor;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, cursorLine, cursorColumn, labelByChar, segments]);

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
            <Text>
              {renderPlaceholderLine(
                placeholderLines[i] ?? " ",
                placeholderLineStartOffsets[i] ?? 0,
                `ph-${i}`,
              )}
            </Text>,
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
            <Text {...textProps}>
              {i === cursorLine && cursorVisible ? "\x1b[7m \x1b[27m" : " "}
              {placeholderLines[i]
                ? renderPlaceholderLine(
                    placeholderLines[i]!,
                    placeholderLineStartOffsets[i] ?? 0,
                    `ph-${i}`,
                  )
                : null}
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

  const lineStartOffsets: number[] = [];
  {
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
      lineStartOffsets.push(offset);
      offset += lines[i]!.length + 1; // +1 for the \n
    }
  }

  const hasAnyLabelStyle = Object.keys(labelTextProps).length > 0;

  for (let lineIdx = 0; lineIdx < linesToRender; lineIdx++) {
    const lineText = lines[lineIdx] ?? "";
    const isVirtualLine = lineIdx >= lines.length;
    const isCursorLine = isActive && lineIdx === cursorLine;
    const lineAbsStart = lineStartOffsets[lineIdx] ?? value.length;

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
      const isLastChunk = c === chunks.length - 1;
      const hasTrailingNewline = lineIdx < lines.length - 1;
      const showNewlineGlyph =
        inv.newline && isLastChunk && hasTrailingNewline;

      const cursorPos = isActiveRow
        ? lineWidth > 0
          ? cursorColumn % lineWidth
          : cursorColumn
        : -1;
      const isCursorAtLineEnd = cursorColumn >= lineText.length;
      const chunkAbsStart = lineAbsStart + (lineWidth > 0 ? c * lineWidth : 0);

      const showPlaceholder =
        !isContinuation && placeholderLines[lineIdx] && !hasContent;

      const useFullBody = showAnyInvisible || hasAnyLabelStyle;

      const bodyNodes: ReactNode[] = useFullBody
        ? renderChunkBody({
            chunk,
            chunkAbsStart,
            cursorPos,
            cursorVisible,
            isCursorAtLineEnd,
            inv,
            showAnyInvisible,
            invisibleProps,
            labelByChar,
            labelTextProps,
          })
        : isActiveRow
          ? [
              <Text key="b">
                {renderChunkWithCursor(
                  chunk,
                  cursorPos,
                  cursorVisible,
                  isCursorAtLineEnd,
                )}
              </Text>,
            ]
          : [<Text key="b">{chunk || " "}</Text>];

      if (
        bodyNodes.length === 0 &&
        !showNewlineGlyph &&
        !showPlaceholder
      ) {
        bodyNodes.push(<Text key="b"> </Text>);
      }

      renderedLines.push(
        renderLine(
          <Text {...textProps}>
            {bodyNodes}
            {showNewlineGlyph ? (
              <Text key="nl" {...invisibleProps}>
                ↵
              </Text>
            ) : null}
            {showPlaceholder
              ? renderPlaceholderLine(
                  placeholderLines[lineIdx]!,
                  placeholderLineStartOffsets[lineIdx] ?? 0,
                  `ph-${lineIdx}`,
                )
              : null}
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
          {placeholderLines[padIdx] && !hasContent
            ? renderPlaceholderLine(
                placeholderLines[padIdx]!,
                placeholderLineStartOffsets[padIdx] ?? 0,
                `ph-pad-${padIdx}`,
              )
            : " "}
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
