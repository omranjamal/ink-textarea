# ink-textarea

> A multiline textarea component for [Ink](https://github.com/vadimdemedes/ink)

Build rich CLI forms with a full-featured textarea that supports multi-line editing, cursor navigation, undo, and customizable line prefixes.

## Install

```bash
npm install ink-textarea
# or
yarn add ink-textarea
# or
pnpm add ink-textarea
```

## Usage

### Basic

```tsx
import { render } from "ink";
import { useState } from "react";
import { TextArea } from "ink-textarea";

const App = () => {
  const [submitted, setSubmitted] = useState("");
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = (value: string) => {
    setSubmitted(value);
    setIsActive(false);
  };

  return (
    <TextArea
      isActive={isActive}
      onSubmit={handleSubmit}
      placeholder="Type your message here..."
    />
  );
};

render(<App />);
```

### With Line Prefix

Render line numbers, borders, or any custom prefix before each line:

```tsx
import { TextArea, LineNumber } from "ink-textarea";

<TextArea
  isActive={true}
  onSubmit={(value) => console.log(value)}
  placeholder="Write some code..."
  highlightActiveLine={true}
  linePrefix={(lineNumber, totalLines, isActiveLine) => (
    <Text>
      <Text color="gray">│ </Text>
      <LineNumber
        lineNumber={lineNumber}
        totalLines={totalLines}
        isActive={isActiveLine}
      />
      <Text color="gray"> │ </Text>
    </Text>
  )}
/>;
```

### Line Number Component

The `LineNumber` component is exported for reuse:

```tsx
import { LineNumber } from "ink-textarea";

// Active line (highlighted)
<LineNumber lineNumber={0} totalLines={10} isActive={true} />

// Inactive line
<LineNumber lineNumber={1} totalLines={10} isActive={false} />
```

## Props

| Prop                    | Type                                                                                        | Description                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `isActive`              | `boolean`                                                                                   | Whether the textarea is focused and receiving keyboard input.                                                                             |
| `onSubmit`              | `(value: string) => void`                                                                   | Called when the user presses **Enter**. Receives the full text.                                                                           |
| `placeholder`           | `string`                                                                                    | Placeholder text shown when the textarea is empty.                                                                                        |
| `linePrefix`            | `ReactNode \| (lineNumber: number, totalLines: number, isActiveLine: boolean) => ReactNode` | Optional prefix rendered before each line. Use for line numbers, gutters, borders, etc. Receives `isActiveLine` to highlight active line. |
| `highlightActiveLine`   | `boolean`                                                                                   | When `true`, the active line is highlighted with a subtle background color. Defaults to `false`.                                          |
| `activeLineColor`       | `string`                                                                                    | Background color for the active line highlight. Defaults to no color.                                                                     |
| `cursorInterval`        | `number`                                                                                    | Cursor blink interval in milliseconds. Defaults to `500`.                                                                                 |
| `typingPause`           | `number`                                                                                    | Milliseconds to wait after typing before resuming cursor blink. Defaults to `450`.                                                        |
| `maxUndo`               | `number`                                                                                    | Maximum number of undo steps to retain. Defaults to `128`.                                                                                |
| `undoGroupDelay`        | `number`                                                                                    | Milliseconds to group consecutive edits into a single undo step. Defaults to `2500`.                                                      |
| `autoNewLineLimit`      | `number`                                                                                    | Maximum number of empty lines allowed after the last line with content. Only applies to Down arrow navigation. Defaults to `3`.           |
| `enableArrowNavigation` | `boolean`                                                                                   | When `false`, disables cursor movement via arrow keys. Useful for implementing suggestion pickers. Defaults to `true`.                    |
| `initialLineCount`      | `number`                                                                                    | Number of lines to display initially. The textarea will maintain at least this many lines. Defaults to `2`.                               |
| `value`                 | `string`                                                                                    | **Controlled mode**: The current value of the textarea. When provided, component operates in controlled mode.                             |
| `cursorPosition`        | `number`                                                                                    | **Controlled mode**: The current cursor position. Use with `value` for full control.                                                      |
| `onChange`              | `(value: string) => void`                                                                   | **Controlled mode**: Called when the value changes.                                                                                       |
| `onCursorChange`        | `(position: number) => void`                                                                | **Controlled mode**: Called when the cursor position changes.                                                                             |

### Controlled Mode

Use controlled mode when you need to manage the textarea state externally:

```tsx
const [value, setValue] = useState("");
const [cursor, setCursor] = useState(0);

<TextArea
  isActive={true}
  value={value}
  cursorPosition={cursor}
  onChange={setValue}
  onCursorChange={setCursor}
  onSubmit={(val) => console.log(val)}
/>;
```

## Keybindings

| Key             | Action                         |
| --------------- | ------------------------------ |
| `Ctrl+J`        | Insert newline                 |
| `Ctrl+Enter`    | Insert newline                 |
| `Shift+Enter`   | Insert newline                 |
| `Alt+Enter`     | Insert newline (Option+Enter)  |
| `Enter`         | Submit                         |
| `↑` / `↓`       | Move cursor between lines      |
| `←` / `→`       | Move cursor left / right       |
| `Opt+←`         | Jump to previous word          |
| `Opt+→`         | Jump to next word              |
| `Ctrl+A`        | Start of current line          |
| `Ctrl+E`        | End of current line            |
| `Ctrl+W`        | Delete word before cursor      |
| `Ctrl+U`        | Delete to start of line        |
| `Ctrl+K`        | Delete to end of line          |
| `Backspace`     | Delete character before cursor |
| `Opt+Backspace` | Delete word before cursor      |
| `Ctrl+Z`        | Undo (up to 128 steps)         |

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm run build

# Watch mode
pnpm run dev

# Run tests
pnpm test

# Format code
pnpm run format
```

## License

MIT
