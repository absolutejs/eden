import { describe, expect, test } from "bun:test";
import {
  clampPageIndex,
  getPageCount,
  getPageRange,
  normalizeOffsetPage,
} from "../src";

describe("normalizeOffsetPage", () => {
  test("applies defaults and clamps unsafe input", () => {
    const bounds = { defaultLimit: 25, maxLimit: 100 };

    expect(normalizeOffsetPage({}, bounds)).toEqual({ limit: 25, offset: 0 });
    expect(normalizeOffsetPage({ limit: 500, offset: 12.9 }, bounds)).toEqual({
      limit: 100,
      offset: 12,
    });
    expect(normalizeOffsetPage({ limit: -1, offset: -2 }, bounds)).toEqual({
      limit: 25,
      offset: 0,
    });
  });
});

describe("page calculations", () => {
  test("counts and clamps pages", () => {
    expect(getPageCount(0, 25)).toBe(1);
    expect(getPageCount(101, 25)).toBe(5);
    expect(clampPageIndex(9, 101, 25)).toBe(4);
  });

  test("returns a one-based visible range", () => {
    expect(getPageRange(0, 25, 0, 0)).toEqual({ end: 0, start: 0 });
    expect(getPageRange(2, 25, 7, 57)).toEqual({ end: 57, start: 51 });
  });
});
