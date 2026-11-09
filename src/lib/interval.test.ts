import { describe, expect, it } from "vitest";
import { intervalStatus, totalDuration } from "./interval";

const cfg = { work: 20, rest: 10, rounds: 3, prep: 5 };

describe("interval timer", () => {
  it("has no trailing rest", () => expect(totalDuration(cfg)).toBe(5 + 60 + 20));
  it("walks through phases", () => {
    expect(intervalStatus(cfg, 0)).toMatchObject({ phase: "prep", remaining: 5 });
    expect(intervalStatus(cfg, 5)).toMatchObject({ phase: "work", round: 1, remaining: 20 });
    expect(intervalStatus(cfg, 26)).toMatchObject({ phase: "rest", round: 1, remaining: 9 });
    expect(intervalStatus(cfg, 35)).toMatchObject({ phase: "work", round: 2 });
    expect(intervalStatus(cfg, 84)).toMatchObject({ phase: "work", round: 3, remaining: 1 });
    expect(intervalStatus(cfg, 85).phase).toBe("done");
  });
});
