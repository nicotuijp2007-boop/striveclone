import { describe, expect, it } from "vitest";
import { DEFAULT_VIDEOS, embedUrl, parseYouTube, videoFor } from "./video";
import { initialState, reducer } from "../store";
import { mergeStates } from "../sync/merge";

describe("parseYouTube", () => {
  it.each([
    ["https://www.youtube.com/watch?v=gRVjAtPip0Y", { id: "gRVjAtPip0Y" }],
    ["https://m.youtube.com/watch?v=gRVjAtPip0Y&feature=share", { id: "gRVjAtPip0Y" }],
    ["https://youtu.be/gRVjAtPip0Y?t=42", { id: "gRVjAtPip0Y", start: 42 }],
    ["https://www.youtube.com/watch?v=gRVjAtPip0Y&t=1m30s", { id: "gRVjAtPip0Y", start: 90 }],
    ["youtube.com/shorts/8fXfwG4ftaQ", { id: "8fXfwG4ftaQ" }],
    ["https://www.youtube-nocookie.com/embed/gRVjAtPip0Y?start=10", { id: "gRVjAtPip0Y", start: 10 }],
    ["https://www.youtube.com/embed/gRVjAtPip0Y?start=10&end=40", { id: "gRVjAtPip0Y", start: 10, end: 40 }],
    ["https://www.youtube.com/embed/gRVjAtPip0Y?start=40&end=10", { id: "gRVjAtPip0Y", start: 40 }],
    ["gRVjAtPip0Y", { id: "gRVjAtPip0Y" }],
  ])("reads %s", (input, expected) => expect(parseYouTube(input)).toEqual(expected));

  it.each(["", "hello", "https://vimeo.com/12345", "https://www.youtube.com/watch?v=short", "https://www.youtube.com/@channel"])(
    "rejects %s",
    (input) => expect(parseYouTube(input)).toBeNull()
  );
});

describe("form video choice", () => {
  it("uses the default, then the user's own link, then none, then the default again", () => {
    let s = initialState();
    expect(videoFor(s, "bench")).toMatchObject({ source: "default", video: { id: DEFAULT_VIDEOS.bench.id } });
    s = reducer(s, { type: "setExerciseVideo", exerciseId: "bench", video: { id: "XFKZ6Yw8XbE", start: 5 } });
    expect(videoFor(s, "bench")).toMatchObject({ source: "custom", video: { id: "XFKZ6Yw8XbE", start: 5 } });
    s = reducer(s, { type: "setExerciseVideo", exerciseId: "bench", video: null });
    expect(videoFor(s, "bench")).toMatchObject({ source: "none", video: null, hasDefault: true });
    s = reducer(s, { type: "setExerciseVideo", exerciseId: "bench", video: "default" });
    expect(videoFor(s, "bench").source).toBe("default");
    expect(s.videoChoices).toHaveLength(1);
  });

  it("has no video for a custom exercise until one is added", () => {
    expect(videoFor(initialState(), "my-exercise")).toEqual({ video: null, source: "none", hasDefault: false });
  });

  it("keeps the most recent choice when two devices sync", () => {
    const phone = reducer(initialState(), { type: "setExerciseVideo", exerciseId: "bench", video: { id: "XFKZ6Yw8XbE" }, now: 100 });
    const laptop = reducer(initialState(), { type: "setExerciseVideo", exerciseId: "bench", video: null, now: 200 });
    expect(videoFor(mergeStates(phone, laptop), "bench").source).toBe("none");
    expect(videoFor(mergeStates(laptop, phone), "bench").source).toBe("none");
  });

  it("embeds without YouTube cookies, autoplaying between the chosen seconds", () => {
    expect(embedUrl({ id: "gRVjAtPip0Y", start: 30 })).toBe("https://www.youtube-nocookie.com/embed/gRVjAtPip0Y?rel=0&playsinline=1&autoplay=1&start=30");
    expect(embedUrl({ id: "gRVjAtPip0Y", start: 30, end: 60 })).toBe("https://www.youtube-nocookie.com/embed/gRVjAtPip0Y?rel=0&playsinline=1&autoplay=1&start=30&end=60");
    expect(embedUrl({ id: "gRVjAtPip0Y" }, { muted: true })).toBe("https://www.youtube-nocookie.com/embed/gRVjAtPip0Y?rel=0&playsinline=1&autoplay=1&mute=1");
  });

  it("gives every default with an end time an end after its start", () => {
    for (const [key, v] of Object.entries(DEFAULT_VIDEOS)) if (v.end) expect(v.end, key).toBeGreaterThan(v.start ?? 0);
    expect(videoFor(initialState(), "pushup").video).toMatchObject({ start: 352, end: 390 });
  });
});
