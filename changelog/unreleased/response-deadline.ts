import type { Change } from "@absolutejs/changelog";

export const change: Change = {
  kind: "added",
  summary:
    "withResponseDeadline: a fetcher for Eden Treaty that gives reads a deadline for their response headers and aborts with ResponseDeadlineError past it, so a request stalled on a bad network fails and can be retried instead of hanging; streamed bodies and writes are left alone",
  symbols: [
    "withResponseDeadline",
    "ResponseDeadlineError",
    "ResponseDeadlineOptions",
    "DEFAULT_RESPONSE_DEADLINE_MS",
  ],
};
