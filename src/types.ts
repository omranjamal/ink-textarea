import type { ReactNode } from "react";

export type TLinePrefixProps = {
  readonly lineNumber: number;
  readonly totalLines: number;
  readonly isActiveLine: boolean;
  readonly isVirtualLine: boolean;
  readonly isContinuationLine: boolean;
  readonly continuationIndex: number;
};

export type TLinePrefixFn = (props: TLinePrefixProps) => ReactNode;

export type TShowInvisibles =
  | boolean
  | {
      readonly space?: boolean;
      readonly tab?: boolean;
      readonly newline?: boolean;
    };

export type TStyleProps = {
  readonly color?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strikethrough?: boolean;
  readonly dim?: boolean;
  readonly inverse?: boolean;
  readonly bgColor?: string;
};

export type TStyles = {
  readonly text?: TStyleProps;
  readonly invisibleCharacter?: TStyleProps;
  readonly [labelName: string]: TStyleProps | undefined;
};

export type TLabelFn = (match: RegExpMatchArray) => string | undefined;
export type TLabelRule = {
  readonly pattern: RegExp;
  readonly label: string | TLabelFn;
};
export type TLabels = readonly TLabelRule[];

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
  readonly onCursorChange?: (
    position: [line: number, col: number],
    type: string,
    chunkIndex: number,
  ) => void;
  // Boundary navigation handlers
  readonly onFirstLineUp?: () => void;
  readonly onLastLineDown?: () => void;
  readonly onFirstCharacterLeft?: () => void;
  readonly onLastCharacterRight?: () => void;
  readonly onTab?: (shift: boolean) => void;
  // Initial line count
  readonly initialLineCount?: number;
  // Maximum number of visual rows to render at once. When set, the textarea
  // virtualizes rendering by slicing visualRows around the cursor and
  // auto-scrolling to keep the cursor visible. Defaults to no cap (renders
  // every row).
  readonly viewportLines?: number;
  readonly tabWidth?: number;
  readonly onDimensions?: (width: number) => void;
  readonly showInvisibles?: TShowInvisibles;
  readonly styles?: TStyles;
  readonly labels?: TLabels;
};
