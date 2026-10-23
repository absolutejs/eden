export { apiError, apiErrorMessage, apiErrorStatus, apiErrorFields, isPaywallError, type ApiError, type ApiFieldError } from "./errors";

// --- Pagination ------------------------------------------------------------

/** Standard response for offset-paginated APIs. */
export type OffsetPage<T> = {
  data: T[];
  total: number;
};

/** Standard response for stable cursor/keyset-paginated APIs. */
export type CursorPage<T, Cursor = string> = {
  data: T[];
  nextCursor: Cursor | null;
};

export type OffsetPageRequest = {
  limit?: number;
  offset?: number;
};

export type PaginationBounds = {
  defaultLimit: number;
  maxLimit: number;
};

const positiveInteger = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

/** Clamp untrusted list-query input to safe integer bounds. */
export const normalizeOffsetPage = (
  request: OffsetPageRequest,
  bounds: PaginationBounds,
): Required<OffsetPageRequest> => {
  const maxLimit = positiveInteger(bounds.maxLimit, 1);
  const defaultLimit = Math.min(
    positiveInteger(bounds.defaultLimit, maxLimit),
    maxLimit,
  );
  const requestedLimit = positiveInteger(request.limit ?? defaultLimit, defaultLimit);
  const requestedOffset = request.offset ?? 0;

  return {
    limit: Math.min(requestedLimit, maxLimit),
    offset:
      Number.isFinite(requestedOffset) && requestedOffset > 0
        ? Math.floor(requestedOffset)
        : 0,
  };
};

export const getPageCount = (total: number, pageSize: number) =>
  Math.max(
    1,
    Math.ceil(Math.max(0, total) / positiveInteger(pageSize, 1)),
  );

export const clampPageIndex = (
  pageIndex: number,
  total: number,
  pageSize: number,
) =>
  Math.max(
    0,
    Math.min(Math.floor(Math.max(0, pageIndex)), getPageCount(total, pageSize) - 1),
  );

/** One-based visible range; an empty result is `{ start: 0, end: 0 }`. */
export const getPageRange = (
  pageIndex: number,
  pageSize: number,
  rowCount: number,
  total: number,
) => {
  if (total <= 0 || rowCount <= 0) return { end: 0, start: 0 };
  const safePageSize = positiveInteger(pageSize, 1);
  const safePage = clampPageIndex(pageIndex, total, safePageSize);
  const start = safePage * safePageSize + 1;

  return { end: Math.min(start + rowCount - 1, total), start };
};

export {
  DEFAULT_RESPONSE_DEADLINE_MS,
  ResponseDeadlineError,
  withResponseDeadline,
  type ResponseDeadlineOptions,
} from "./responseDeadline";
