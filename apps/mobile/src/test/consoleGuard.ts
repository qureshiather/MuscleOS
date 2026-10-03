import { format } from 'node:util';

/**
 * Fails the current test when it writes an unexpected `console.error` / `console.warn`, so test
 * output stays clean and new warnings (act(...), app `__DEV__` logging, deprecations) can't creep
 * back in unnoticed. Shared by the Vitest and Jest setups.
 *
 * A test that deliberately drives a path that logs (a failed sync, a failed export) spies on the
 * console itself — `jest.spyOn(console, 'warn').mockImplementation(() => undefined)` or the `vi`
 * equivalent — and ideally asserts the call. The spy replaces this guard for that test.
 *
 * `allow` is for genuinely unavoidable third-party lines only; document each entry where it's
 * passed.
 */
export function installConsoleGuard(afterEach: (fn: () => void) => void, allow: RegExp[] = []): void {
  const unexpected: string[] = [];

  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      const message = format(...args);
      if (allow.some((pattern) => pattern.test(message))) return;
      unexpected.push(`console.${level}: ${message}`);
      original(...args);
    };
  }

  afterEach(() => {
    if (unexpected.length === 0) return;
    const lines = unexpected.splice(0);
    throw new Error(
      `Unexpected console output (${lines.length}). Fix the cause, or spy on the console in the test ` +
        `that deliberately triggers it (docs/engineering/testing.md#conventions):\n\n${lines.join('\n\n')}`
    );
  });
}
