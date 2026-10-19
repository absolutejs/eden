/**
 * A response deadline for reads. On a bad network a request can stall with
 * no error at all, and a page waiting on it spins forever. Wrapping an Eden
 * Treaty client's fetcher gives every GET/HEAD a deadline for its response
 * HEADERS: past it the request is aborted with a `ResponseDeadlineError`, so
 * the caller (React Query, a retry loop) can try again.
 *
 * Once headers arrive the deadline is over, so a streamed body (SSE, a large
 * download) runs as long as it needs. Other methods are left alone: aborting
 * a write in the browser does not stop it on the server, and reporting a
 * change that went through as failed invites a duplicate.
 */

export const DEFAULT_RESPONSE_DEADLINE_MS = 20_000;

/** The request's response headers did not arrive within its deadline. */
export class ResponseDeadlineError extends Error {
  readonly deadlineMs: number;

  constructor(deadlineMs: number) {
    super(
      `No response within ${Math.round(deadlineMs / 1_000)} seconds. Check the connection and try again.`,
    );
    this.name = "ResponseDeadlineError";
    this.deadlineMs = deadlineMs;
  }
}

export type ResponseDeadlineOptions = {
  /** How long to wait for response headers. */
  ms?: number;
  /** Methods that get a deadline; others pass straight through. */
  methods?: readonly string[];
};

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const requestMethod = (input: RequestInfo | URL, init?: RequestInit) =>
  (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

const requestSignal = (input: RequestInfo | URL, init?: RequestInit) =>
  init?.signal ?? (input instanceof Request ? input.signal : undefined);

/**
 * Wrap a fetcher so reads get a response deadline. The default fetcher is
 * looked up on each call, so a `fetch` replaced later (a test, a polyfill)
 * is still the one used.
 */
export const withResponseDeadline = (
  fetcher: Fetcher = (input, init) => globalThis.fetch(input, init),
  options: ResponseDeadlineOptions = {},
): typeof fetch => {
  const ms = options.ms ?? DEFAULT_RESPONSE_DEADLINE_MS;
  const methods = new Set(
    (options.methods ?? ["GET", "HEAD"]).map((method) => method.toUpperCase()),
  );
  const deadlined: Fetcher = async (input, init) => {
    if (!methods.has(requestMethod(input, init))) return fetcher(input, init);
    const controller = new AbortController();
    // The caller's own signal still cancels the request, body included.
    const callerSignal = requestSignal(input, init);
    if (callerSignal?.aborted) controller.abort(callerSignal.reason);
    else
      callerSignal?.addEventListener(
        "abort",
        () => controller.abort(callerSignal.reason),
        { once: true },
      );
    const timer = setTimeout(
      () => controller.abort(new ResponseDeadlineError(ms)),
      ms,
    );
    try {
      return await fetcher(input, { ...init, signal: controller.signal });
    } catch (error) {
      const reason: unknown = controller.signal.reason;
      if (reason instanceof ResponseDeadlineError) throw reason;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  return deadlined as typeof fetch;
};
