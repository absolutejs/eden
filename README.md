# @absolutejs/eden

Tiny error helpers for [Eden Treaty](https://elysiajs.com/eden/treaty/overview)
clients. Eden surfaces a failed call as `{ status, value }` — and most call
sites `throw error.value`, dropping the HTTP status so a 402 paywall, a 409
conflict, and a 500 all look the same downstream. This fixes that.

```ts
import { apiError, isPaywallError } from "@absolutejs/eden";

const { data, error } = await api.things.get();
if (error) throw apiError(error); // a real Error that KEEPS error.status

// elsewhere
try {
  await loadPremiumPanel();
} catch (e) {
  if (isPaywallError(e)) showUpgradeNudge();
  else showError(apiErrorMessage(e));
}
```

## API

- `apiError(error, fallback?)` — normalize any thrown value (or an Eden
  `{ status, value }`) into an `Error` that keeps `.status`.
- `apiErrorMessage(error, fallback?)` — best-effort human message.
- `apiErrorStatus(error)` — the HTTP status carried by an error, if any.
- `isPaywallError(error)` — true for a 402 Payment Required.

## Pagination

List endpoints can share one bounded request/response contract without hiding
their concrete database query:

```ts
import {
  normalizeOffsetPage,
  type OffsetPage,
} from "@absolutejs/eden";

const { limit, offset } = normalizeOffsetPage(request, {
  defaultLimit: 25,
  maxLimit: 100,
});

const response: OffsetPage<User> = { data: rows, total };
```

`CursorPage<T>` is the corresponding envelope for stable keyset pagination.
`getPageCount`, `clampPageIndex`, and `getPageRange` keep client pagination math
consistent with the server contract.

Zero dependencies; works in the browser and on the server.

Apache-2.0
