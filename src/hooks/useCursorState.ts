import { useState, useEffect, useRef } from "react";
import { getCursorFromLineColumn } from "../textUtils.js";

type UseCursorStateOptions = {
  controlledValue: string | undefined;
  controlledPosition: [number, number] | undefined;
  onChange: ((value: string) => void) | undefined;
  onCursorAttempt:
    | ((newCursor: number, valueForCalculation?: string) => void)
    | undefined;
};

type UseCursorStateReturn = {
  value: string;
  cursor: number;
  setValue: (updater: string | ((prev: string) => string)) => void;
  setCursor: (
    updater: number | ((prev: number) => number),
    valueForCalculation?: string,
  ) => void;
};

export const useCursorState = ({
  controlledValue,
  controlledPosition,
  onChange,
  onCursorAttempt,
}: UseCursorStateOptions): UseCursorStateReturn => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState("");
  const [internalCursor, setInternalCursor] = useState(0);

  const valueRef = useRef(isControlled ? controlledValue : internalValue);
  const value = isControlled ? controlledValue : internalValue;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const processExternalPosition = (): {
    cursor: number;
    wasClamped: boolean;
  } => {
    if (controlledPosition === undefined) {
      return { cursor: internalCursor, wasClamped: false };
    }
    const [line, col] = controlledPosition;
    const { cursor, clampedLine, clampedCol } = getCursorFromLineColumn(
      value,
      line,
      col,
    );
    return {
      cursor,
      wasClamped: line !== clampedLine || col !== clampedCol,
    };
  };

  const { cursor, wasClamped } = processExternalPosition();

  useEffect(() => {
    if (wasClamped && onCursorAttempt) {
      onCursorAttempt(cursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wasClamped, cursor]);

  useEffect(() => {
    if (!isControlled && onChange) {
      onChange(internalValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = (updater: string | ((prev: string) => string)): void => {
    const newValue = typeof updater === "function" ? updater(value) : updater;
    if (!isControlled) {
      setInternalValue(newValue);
    }
    onChange?.(newValue);
  };

  const setCursor = (
    updater: number | ((prev: number) => number),
    valueForCalculation?: string,
  ): void => {
    const newCursor = typeof updater === "function" ? updater(cursor) : updater;
    if (!isControlled) {
      setInternalCursor(newCursor);
    }
    if (onCursorAttempt) {
      onCursorAttempt(newCursor, valueForCalculation);
    }
  };

  return { value, cursor, setValue, setCursor };
};
