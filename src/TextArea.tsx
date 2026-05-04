import { Box, Text, useBoxMetrics, useStdout } from "ink";
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
  DEFAULT_TAB_WIDTH,
  DEFAULT_KEYBINDINGS,
  NAV_KEYBINDINGS,
} from "./constants.js";
import {
  getCursorLineAndColumn,
  computeLabels,
  computeSegments,
  getLabelAt,
  findSegmentIndex,
  buildVisualRows,
  visualRowForCursor,
} from "./textUtils.js";
import { useCursorState } from "./hooks/useCursorState.js";
import { useUndo } from "./hooks/useUndo.js";
import { useCursorBlink } from "./hooks/useCursorBlink.js";
import { useKeyboardInput } from "./hooks/useKeyboardInput.js";
import { useViewport } from "./hooks/useViewport.js";
import type {
  TextAreaProps,
  TLinePrefixProps,
  TStyleProps,
  TStyles,
  TKeybinding,
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
  tabWidth: number;
};

const graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

const isAsciiOnly = (s: string): boolean => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x80 || c < 0x20) return false;
  }
  return true;
};

const renderRowBody = ({
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
  tabWidth,
}: RenderChunkBodyArgs): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let buf = "";
  let bufKey: string | null = null;
  let segIdx = 0;

  const propsForKey = (
    key: string,
  ): ReturnType<typeof styleToTextProps> | undefined => {
    const sep = key.indexOf("|");
    const label = key.slice(0, sep);
    const mode = key.slice(sep + 1);
    if (mode === "I") return invisibleProps;
    return label && label !== "text" ? labelTextProps[label] : undefined;
  };

  const flush = (): void => {
    if (buf.length === 0) return;
    const props = propsForKey(bufKey!);
    nodes.push(
      <Text key={`s${segIdx++}`} {...props}>
        {buf}
      </Text>,
    );
    buf = "";
    bufKey = null;
  };

  type Step = { unit: string; codeUnitOffset: number };
  const steps: Step[] = [];
  if (isAsciiOnly(chunk)) {
    for (let i = 0; i < chunk.length; i++) {
      steps.push({ unit: chunk[i]!, codeUnitOffset: i });
    }
  } else {
    for (const seg of graphemeSegmenter.segment(chunk)) {
      steps.push({ unit: seg.segment, codeUnitOffset: seg.index });
    }
  }

  for (const step of steps) {
    const g = step.unit;
    const i = step.codeUnitOffset;
    let isInv: boolean;
    let display: string;
    if (g === "\t") {
      if (showAnyInvisible && inv.tab) {
        display = "→" + " ".repeat(Math.max(0, tabWidth - 1));
        isInv = true;
      } else {
        display = " ".repeat(Math.max(1, tabWidth));
        isInv = false;
      }
    } else {
      isInv = showAnyInvisible && g === " " && inv.space;
      display = isInv ? "·" : g;
    }
    const charLabel = isInv ? "" : (labelByChar[chunkAbsStart + i] ?? "text");
    const isCur = i === cursorPos;
    const cellStr = isCur
      ? cursorVisible
        ? g === "\t"
          ? `\x1b[7m${display.charAt(0)}\x1b[27m${display.slice(1)}`
          : `\x1b[7m${display}\x1b[27m`
        : display === " " && isCursorAtLineEnd
          ? " "
          : display
      : display;
    const key = `${charLabel}|${isInv ? "I" : "T"}`;
    if (key !== bufKey) flush();
    bufKey = key;
    buf += cellStr;
  }

  if (cursorPos === chunk.length) {
    const cursorStr = cursorVisible ? "\x1b[7m \x1b[27m" : " ";
    const key = "text|T";
    if (key !== bufKey) flush();
    bufKey = key;
    buf += cursorStr;
  }

  flush();
  return nodes;
};

export const TextArea = ({
  focus: isActive,
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
  disableArrowNavigation = false,
  value: controlledValue,
  cursorPosition: controlledPosition,
  onChange,
  onCursorChange,
  onFirstLineUp,
  onLastLineDown,
  onFirstCharacterLeft,
  onLastCharacterRight,
  onTab,
  initialLineCount = DEFAULT_INITIAL_LINE_COUNT,
  viewportLines,
  tabWidth = DEFAULT_TAB_WIDTH,
  onDimensions,
  showInvisibles = false,
  styles,
  labels,
  keybindings,
}: TextAreaProps): ReactNode => {
  const resolvedKeybindings = useMemo<Readonly<Record<TKeybinding, boolean>>>(() => {
    const merged: Record<TKeybinding, boolean> = {
      ...DEFAULT_KEYBINDINGS,
      ...(keybindings ?? {}),
    };
    if (disableArrowNavigation === true) {
      for (const k of NAV_KEYBINDINGS) merged[k] = false;
    }
    return merged;
  }, [keybindings, disableArrowNavigation]);
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

  const lines = useMemo(() => value.split("\n"), [value]);

  const placeholderLines = useMemo(
    () => (placeholder ? placeholder.split("\n") : []),
    [placeholder],
  );

  const placeholderLineStartOffsets = useMemo(() => {
    const offsets: number[] = new Array(placeholderLines.length);
    let offset = 0;
    for (let i = 0; i < placeholderLines.length; i++) {
      offsets[i] = offset;
      offset += placeholderLines[i]!.length + 1;
    }
    return offsets;
  }, [placeholderLines]);

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

  const { line: cursorLine, column: cursorColumn } = getCursorLineAndColumn(
    value,
    cursor,
  );

  const visualRows = useMemo(
    () =>
      buildVisualRows(
        lines,
        lineWidth,
        isActive ? cursorLine : -1,
        isActive ? cursorColumn : 0,
        initialLineCount,
        tabWidth,
      ),
    [lines, lineWidth, isActive, cursorLine, cursorColumn, initialLineCount, tabWidth],
  );

  useKeyboardInput({
    isActive,
    value,
    cursor,
    keybindings: resolvedKeybindings,
    autoNewLineLimit,
    onSubmit,
    onFirstLineUp,
    onLastLineDown,
    onFirstCharacterLeft,
    onLastCharacterRight,
    onTab,
    setValue,
    setCursor,
    pushUndo,
    popUndo,
    resetMutationTracking,
    resetBlink,
    lineWidth,
    visualRows,
  });

  const totalLines = Math.max(lines.length, initialLineCount);
  const hasContent = value.length > 0;

  const labelByChar = useMemo(
    () => computeLabels(value, labels ?? []),
    [value, labels],
  );
  const segments = useMemo(() => computeSegments(labelByChar), [labelByChar]);

  const placeholderLabelByChar = useMemo(
    () => computeLabels(placeholder ?? "", labels ?? []),
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
      dispatchCursorRef.current?.(cursor);
    }
    prevCursorRef.current = cursor;
  }, [cursor]);

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

  const cursorRowIndex = isActive
    ? visualRowForCursor(visualRows, cursorLine, cursorColumn, lineWidth)
    : -1;

  const { stdout } = useStdout();
  const [terminalRows, setTerminalRows] = useState<number>(stdout?.rows ?? 0);
  useEffect(() => {
    if (!stdout) return;
    const onResize = (): void => setTerminalRows(stdout.rows);
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  const resolvedViewportLines =
    viewportLines ??
    (terminalRows > 0
      ? Math.max(1, Math.floor(terminalRows * 0.5))
      : Number.POSITIVE_INFINITY);

  const { visibleRowStart, visibleRowEnd } = useViewport({
    rowCount: Math.max(visualRows.length, initialLineCount),
    viewportLines: resolvedViewportLines,
    cursorRowIndex,
  });

  if (value.length === 0 && !isActive && placeholderLines.length > 0) {
    const visibleCount = Math.max(0, visibleRowEnd - visibleRowStart);
    return (
      <Box flexDirection="column" width="100%">
        {Array.from({ length: visibleCount }, (_, k) => {
          const i = visibleRowStart + k;
          return renderLine(
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
            k === 0 ? contentRef : undefined,
            false,
            0,
            false,
          );
        })}
      </Box>
    );
  }

  if (value.length === 0 && isActive) {
    const visibleCount = Math.max(0, visibleRowEnd - visibleRowStart);
    return (
      <Box flexDirection="column" width="100%">
        {Array.from({ length: visibleCount }, (_, k) => {
          const i = visibleRowStart + k;
          const phLine = placeholderLines[i];
          const isCursorRow = i === cursorLine && cursorVisible;
          let content: ReactNode;
          if (phLine && phLine.length > 0) {
            const firstChar = phLine[0]!;
            const restOffset = (placeholderLineStartOffsets[i] ?? 0) + 1;
            const rest = phLine.slice(1);
            content = (
              <Text {...textProps}>
                {isCursorRow ? (
                  <Text key="cur">{`\x1b[7m${firstChar}\x1b[27m`}</Text>
                ) : (
                  renderPlaceholderLine(
                    firstChar,
                    placeholderLineStartOffsets[i] ?? 0,
                    `ph-${i}-h`,
                  )
                )}
                {rest.length > 0
                  ? renderPlaceholderLine(rest, restOffset, `ph-${i}-r`)
                  : null}
              </Text>
            );
          } else {
            content = (
              <Text {...textProps}>
                {isCursorRow ? "\x1b[7m \x1b[27m" : " "}
              </Text>
            );
          }
          return renderLine(
            content,
            i,
            i,
            initialLineCount,
            i > 0,
            k === 0 ? contentRef : undefined,
            false,
            0,
            isActive && i === cursorLine,
          );
        })}
      </Box>
    );
  }

  const renderedLines: ReactNode[] = [];

  for (let i = visibleRowStart; i < visibleRowEnd; i++) {
    const row = visualRows[i]!;
    const lineIdx = row.lineIdx;
    const c = row.chunkIdx;
    const isVirtualLine = row.isVirtualLine;
    const lineText = isVirtualLine ? "" : (lines[lineIdx] ?? "");
    const isCursorLine = isActive && !isVirtualLine && lineIdx === cursorLine;
    const isContinuation = c > 0;
    const cursorVisualRow =
      isCursorLine && lineWidth > 0 ? Math.floor(cursorColumn / lineWidth) : 0;
    const isActiveRow = isCursorLine && c === cursorVisualRow;
    const hasTrailingNewline = !isVirtualLine && lineIdx < lines.length - 1;
    const showNewlineGlyph =
      inv.newline && row.isLastChunkOfLine && hasTrailingNewline;
    const cursorPos = isActiveRow
      ? lineWidth > 0
        ? cursorColumn % lineWidth
        : cursorColumn
      : -1;
    const isCursorAtLineEnd = cursorColumn >= lineText.length;
    const chunkAbsStart = row.absStart;

    const showPlaceholder =
      !isContinuation && !!placeholderLines[lineIdx] && !hasContent;

    if (isVirtualLine) {
      renderedLines.push(
        renderLine(
          <Text>
            {showPlaceholder
              ? renderPlaceholderLine(
                  placeholderLines[lineIdx]!,
                  placeholderLineStartOffsets[lineIdx] ?? 0,
                  `ph-pad-${lineIdx}`,
                )
              : " "}
          </Text>,
          `pad-${lineIdx}`,
          lineIdx,
          totalLines,
          true,
          undefined,
          false,
          0,
          false,
        ),
      );
      continue;
    }

    const chunk = row.text;
    const bodyNodes: ReactNode[] = renderRowBody({
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
      tabWidth,
    });

    if (bodyNodes.length === 0 && !showNewlineGlyph && !showPlaceholder) {
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
        false,
        i === visibleRowStart ? contentRef : undefined,
        isContinuation,
        c,
        isActiveRow,
      ),
    );
  }

  return <Box flexDirection="column" width="100%">{renderedLines}</Box>;
};
