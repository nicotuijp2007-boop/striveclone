import { describe, expect, it } from "vitest";
import { arrangeTiles, moveTile, periodLabel, toggleHidden } from "./dashboard";

describe("dashboard layout", () => {
  it("follows the saved order, adds new tiles at the end and skips removed ones", () => {
    expect(arrangeTiles(["week", "bodyweight", "lift:a", "lift:b"], ["lift:a", "gone", "week"]))
      .toEqual(["lift:a", "week", "bodyweight", "lift:b"]);
  });

  it("moves a tile one place and stops at the ends", () => {
    expect(moveTile(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveTile(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });

  it("toggles hidden tiles", () => {
    const l = { order: [], hidden: ["a"], months: 3 as const };
    expect(toggleHidden(l, "a").hidden).toEqual([]);
    expect(toggleHidden(l, "b").hidden).toEqual(["a", "b"]);
  });

  it("names the period", () => {
    expect(periodLabel(1)).toBe("last 1 month");
    expect(periodLabel(6)).toBe("last 6 months");
    expect(periodLabel(12)).toBe("last year");
  });
});
