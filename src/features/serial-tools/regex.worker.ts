export {};
type Request = { id: number; source: string; values: string[] };
const scope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage: (message: unknown) => void };
scope.onmessage = (event: MessageEvent<Request>) => {
  const { id, source, values } = event.data;
  try {
    const regex = new RegExp(source);
    const matches = values.map(value => { regex.lastIndex = 0; return regex.test(value); });
    scope.postMessage({ id, ok: true, matches });
  } catch (error) {
    scope.postMessage({ id, ok: false, error: error instanceof Error ? error.message : 'Invalid pattern.' });
  }
};
// Native worker loading has a separate deadline from regex execution.
scope.postMessage({ ready: true });
