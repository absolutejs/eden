import { describe, expect, test } from "bun:test";
import { ResponseDeadlineError, withResponseDeadline } from "../src";

/* A server that answers after `headersAfterMs`, then streams its body. */
const slowFetcher =
  (headersAfterMs: number, seen: RequestInit[] = []) =>
  (_input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(init ?? {});

    return new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => {
        const encoder = new TextEncoder();
        resolve(
          new Response(
            new ReadableStream({
              async start(controller) {
                controller.enqueue(encoder.encode("first "));
                await Bun.sleep(60);
                controller.enqueue(encoder.encode("second"));
                controller.close();
              },
            }),
          ),
        );
      }, headersAfterMs);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(init.signal?.reason);
      });
    });
  };

describe("withResponseDeadline", () => {
  test("a read whose headers never come is aborted with a ResponseDeadlineError", async () => {
    const fetcher = withResponseDeadline(slowFetcher(1_000), { ms: 30 });
    const error = await fetcher("https://example.test/api").catch((e) => e);
    expect(error).toBeInstanceOf(ResponseDeadlineError);
    expect((error as ResponseDeadlineError).deadlineMs).toBe(30);
  });

  test("once headers arrive, a body that streams past the deadline still completes", async () => {
    const fetcher = withResponseDeadline(slowFetcher(5), { ms: 30 });
    const response = await fetcher("https://example.test/api/stream");
    expect(await response.text()).toBe("first second");
  });

  test("writes are never given a deadline", async () => {
    const seen: RequestInit[] = [];
    const fetcher = withResponseDeadline(slowFetcher(60, seen), { ms: 10 });
    const response = await fetcher("https://example.test/api", {
      method: "POST",
    });
    expect(response.ok).toBe(true);
    expect(seen[0]?.signal).toBeUndefined();
  });

  test("the caller's own abort still cancels, with its own reason", async () => {
    const fetcher = withResponseDeadline(slowFetcher(1_000), { ms: 5_000 });
    const caller = new AbortController();
    const pending = fetcher("https://example.test/api", {
      signal: caller.signal,
    }).catch((e) => e);
    caller.abort(new Error("navigated away"));
    const error = await pending;
    expect(error).not.toBeInstanceOf(ResponseDeadlineError);
    expect((error as Error).message).toBe("navigated away");
  });

  test("uses the global fetch at call time when none is given", async () => {
    const original = globalThis.fetch;
    const fetcher = withResponseDeadline(undefined, { ms: 1_000 });
    globalThis.fetch = (async () =>
      new Response("replaced")) as unknown as typeof fetch;
    try {
      expect(await (await fetcher("https://example.test/")).text()).toBe(
        "replaced",
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});
