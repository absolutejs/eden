/**
 * @absolutejs/eden — error helpers for Eden Treaty clients.
 *
 * Eden surfaces a failed call as `{ status, value }` (or throws an arbitrary
 * value). Most call sites `throw error.value`, which drops the HTTP status —
 * so a 402 paywall, a 409 conflict, and a 500 all look the same downstream.
 * These helpers normalize any thrown value into a real `Error` that KEEPS the
 * status, plus a robust message extractor and a couple of status predicates.
 *
 * Zero dependencies — works in the browser and on the server.
 */

const readStringField = (value: object, key: string): string | null => {
  const field: unknown = Reflect.get(value, key);

  return typeof field === "string" && field.trim() ? field : null;
};

const readNumberField = (value: object, key: string): number | undefined => {
  const field: unknown = Reflect.get(value, key);

  return typeof field === "number" ? field : undefined;
};

/** An Error carrying the originating HTTP status, when known. */
export type ApiError = Error & { status?: number };

const HTTP_PAYMENT_REQUIRED = 402;

// Eden treaty surfaces failures as `{ status, value }` — `value` is the body
// (the message), `status` the HTTP code.
const isEdenError = (
  error: unknown,
): error is { status: number; value: unknown } =>
  typeof error === "object" &&
  error !== null &&
  "value" in error &&
  readNumberField(error, "status") !== undefined;

// Non-recursive core: turn an arbitrary thrown value into an Error. Kept
// separate from `apiError` so the eden-unwrap path doesn't self-reference it.
const toError = (error: unknown, fallback?: string): ApiError => {
  const base: ApiError =
    error instanceof Error && error.message
      ? error
      : new Error(apiErrorMessage(error, fallback));

  return base;
};

/**
 * Normalize any thrown value (or an Eden `{ status, value }`) into an `Error`
 * that keeps the HTTP status. Throw this instead of `error.value`.
 */
export const apiError = (error: unknown, fallback?: string): ApiError => {
  if (isEdenError(error)) {
    const built = toError(error.value, fallback);
    built.status = error.status;

    return built;
  }

  return toError(error, fallback);
};

/** Best-effort human message from any thrown value. */
export const apiErrorMessage = (
  error: unknown,
  fallback = "Request failed",
): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error === null || typeof error !== "object") return fallback;

  return (
    readStringField(error, "message") ??
    readStringField(error, "summary") ??
    readStringField(error, "error") ??
    readStringField(error, "status") ??
    fallback
  );
};

/** The HTTP status carried by an error, if any (Error.status or an Eden shape). */
export const apiErrorStatus = (error: unknown): number | undefined => {
  if (error === null || typeof error !== "object") return undefined;

  return readNumberField(error, "status");
};

/** True when a thrown error is a 402 Payment Required (paywall) — distinct from
 *  a real failure, so a locked premium surface can render an upgrade nudge. */
export const isPaywallError = (error: unknown): boolean =>
  apiErrorStatus(error) === HTTP_PAYMENT_REQUIRED;
