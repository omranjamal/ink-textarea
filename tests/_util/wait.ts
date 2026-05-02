// Shared async test helpers for ink-testing-library tests.
//
// `tick` is a fixed micro-sleep used between successive stdin.write() calls
// to give ink/React time to drain a single input + render cycle. Default
// 30 ms — enough for the common case, intentionally short so suites don't
// pay the wall-clock cost on every keystroke.
//
// `settle` is the deterministic cousin of "wait long enough": it polls
// lastFrame() until it stops changing for `quietMs` consecutive ms, or
// `maxMs` overall elapses. Use it BEFORE the final assertion of a test
// that issues a sequence of stdin.writes — that's the spot where a fixed
// tick races state updates under suite load and produces flakes.

export const tick = (ms = 30): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string | undefined): string =>
  (s ?? "").replace(ANSI_RE, "");

export const settle = async (
  lastFrame: () => string | undefined,
  quietMs = 80,
  maxMs = 1500,
): Promise<void> => {
  // Compare ANSI-stripped frames so cursor-blink toggles (which swap
  // \x1b[7m...\x1b[27m around a character) don't keep us spinning. The
  // structural content of the frame is what we wait to settle.
  const start = Date.now();
  let prev = stripAnsi(lastFrame());
  let stableSince = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 15));
    const cur = stripAnsi(lastFrame());
    if (cur !== prev) {
      prev = cur;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= quietMs) {
      return;
    }
  }
};

// Poll `predicate()` until it returns truthy, or timeout. Returns when the
// condition is met. Use for callback-based assertions where settle() can't
// help (e.g. waiting for a vi.fn() to be called).
export const waitFor = async (
  predicate: () => boolean,
  maxMs = 3000,
  intervalMs = 15,
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
};
