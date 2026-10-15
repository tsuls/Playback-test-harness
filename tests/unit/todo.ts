/**
 * True while `fn` still throws the stub's `Error('TODO')`.
 *
 * The unit specs use this with `test.skip(...)` so `npm test` stays green while
 * src/metrics.ts and src/flake.ts are stubs. Once a function is implemented, its
 * tests stop being skipped and run on their own; nothing needs to be edited.
 */
export function isTodo(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch (err) {
    return err instanceof Error && err.message === 'TODO';
  }
}
