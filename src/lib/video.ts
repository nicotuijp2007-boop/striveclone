import type { AppState, VideoRef } from "../types";

/** A default form video for a built-in exercise, with the channel it's from. */
export interface DefaultVideo extends VideoRef {
  channel: string;
}

/**
 * Form videos for the built-in exercises. Each was checked with YouTube's oEmbed endpoint to exist,
 * allow embedding, and come from the channel listed; start times come from the videos' own chapters.
 * Users can swap any of them in the app.
 */
export const DEFAULT_VIDEOS: Record<string, DefaultVideo> = {
  // Jeff Nippard, starting at the chapter where the exercise's technique is explained.
  bench: { id: "vcBig73ojpE", start: 103, channel: "Jeff Nippard" }, // 1:43 Setup
  "incline-bench": { id: "fGm-ef-4PVk", start: 153, channel: "Jeff Nippard" }, // 2:33 Incline Bench Press
  "incline-db": { id: "fGm-ef-4PVk", start: 256, channel: "Jeff Nippard" }, // 4:16 Incline Dumbbell Press
  pushup: { id: "fGm-ef-4PVk", start: 352, channel: "Jeff Nippard" }, // 5:52 Push-Ups
  deadlift: { id: "VL5Ab0T07e4", start: 133, channel: "Jeff Nippard" }, // 2:13 Equipment and setup
  row: { id: "axoeDmW0oAY", start: 107, channel: "Jeff Nippard" }, // 1:47 Setup and standards
  // TNF (Joel Twinem): the two exercises with a dedicated technique chapter in his videos.
  pullup: { id: "H5iWiITjSsk", start: 631, channel: "TNF" }, // 10:31 Pull-up techniques
  "lat-pulldown": { id: "CfF9yHddPxA", start: 647, channel: "TNF" }, // 10:47 Proper lat pulldown technique
  "pec-deck": { id: "ADfBvG03mlQ", start: 210, channel: "TNF" }, // 3:30 Pec deck machine techniques
  "incline-smith": { id: "ADfBvG03mlQ", start: 49, channel: "TNF" }, // 0:49 Incline smith chest press
  squat: { id: "bEv6CCg2BC8", start: 148, channel: "Jeff Nippard" }, // 2:28 Bar setup and walkout
  rdl: { id: "_oyxCn2iSjU", start: 82, channel: "Jeff Nippard" }, // 1:22 RDL setup and execution
  lunge: { id: "3ryh7PNhz3E", start: 565, channel: "Jeff Nippard" }, // 9:25 Walking Lunge
  ohp: { id: "_RlRDWO2jfg", start: 112, channel: "Jeff Nippard" }, // 1:52 Setup and bar loading
  "plate-shoulder-press": { id: "SgyUoY0IZ7A", start: 349, channel: "Jeff Nippard" }, // 5:49 Machine Shoulder Press
  "lateral-raise": { id: "v_ZkxWzYnMc", start: 191, channel: "Jeff Nippard" }, // 3:11 Lateral Raise Technique
  "cable-lateral-raise": { id: "SgyUoY0IZ7A", start: 477, channel: "Jeff Nippard" }, // 7:57 Cable Lateral Raise
  "cable-rear-delt-fly": { id: "SgyUoY0IZ7A", start: 718, channel: "Jeff Nippard" }, // 11:58 Reverse Cable Crossover
  "reverse-pec-deck": { id: "SgyUoY0IZ7A", start: 626, channel: "Jeff Nippard" }, // 10:26 Reverse Pec Deck
  curl: { id: "GNO4OtYoCYk", start: 116, channel: "Jeff Nippard" }, // 1:56 Barbell Curl
  "preacher-curl": { id: "GNO4OtYoCYk", start: 368, channel: "Jeff Nippard" }, // 6:08 Scott Curl (barbell/EZ preacher curl)
  "db-preacher-curl": { id: "GNO4OtYoCYk", start: 265, channel: "Jeff Nippard" }, // 4:25 DB Preacher Curl
  "tricep-pushdown": { id: "OpRMRhr0Ycc", start: 60, channel: "Jeff Nippard" }, // 1:00 Triceps Pressdown
  // No Jeff Nippard or TNF chapter for the one-arm version: a dedicated tutorial instead.
  "one-arm-tricep-ext": { id: "YZngJdQ71k0", channel: "Jayd Harrison" }, // Single Arm Tricep Pushdown (Proper Form Tutorial)
  plank: { id: "1G0y8D5rFDc", start: 74, channel: "Jeff Nippard" }, // 1:14 Plank
  "hanging-leg-raise": { id: "2RrGnjxSsiA", start: 247, channel: "Jeff Nippard" }, // 4:07 Hanging leg raises
  "kb-swing": { id: "3ryh7PNhz3E", start: 765, channel: "Jeff Nippard" }, // 12:45 Kettlebell Swing
  // No suitable Jeff Nippard video (or no chapter to point at): other channels.
  "leg-press": { id: "cDGOn-yfKJA", channel: "NASM" },
  burpee: { id: "qLBImHhCXSw", channel: "Well+Good" },
  "row-erg": { id: "40ux8YGY0PU", channel: "Philadelphia College of Osteopathic Medicine" },
};

const ID = /^[A-Za-z0-9_-]{11}$/;

/** Read "1m30s", "90s" or "90" as seconds. */
const parseTime = (t: string | null): number | undefined => {
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return Number(t) || undefined;
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !m[0]) return undefined;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return s || undefined;
};

/** Turn a pasted YouTube link (watch, youtu.be, shorts, embed, or a bare ID) into a video reference. */
export function parseYouTube(input: string): VideoRef | null {
  const text = input.trim();
  if (ID.test(text)) return { id: text };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
      id = m?.[1] ?? null;
    }
  }
  if (!id || !ID.test(id)) return null;
  const start = parseTime(url.searchParams.get("t") ?? url.searchParams.get("start"));
  return start ? { id, start } : { id };
}

export interface ResolvedVideo {
  video: VideoRef | null;
  /** Channel name for built-in defaults. */
  channel?: string;
  source: "default" | "custom" | "none";
  hasDefault: boolean;
}

/** The video to show for an exercise: the user's choice if they made one, otherwise the default. */
export function videoFor(state: Pick<AppState, "videoChoices">, exerciseId: string): ResolvedVideo {
  const def = DEFAULT_VIDEOS[exerciseId];
  const choice = state.videoChoices.find((c) => c.exerciseId === exerciseId);
  const hasDefault = !!def;
  if (choice && choice.video !== "default") {
    return choice.video ? { video: choice.video, source: "custom", hasDefault } : { video: null, source: "none", hasDefault };
  }
  return def ? { video: { id: def.id, start: def.start }, channel: def.channel, source: "default", hasDefault } : { video: null, source: "none", hasDefault };
}

/** Privacy-enhanced embed: no YouTube cookies until the viewer presses play. */
export const embedUrl = (v: VideoRef): string =>
  `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&playsinline=1${v.start ? `&start=${v.start}` : ""}`;

export const watchUrl = (v: VideoRef): string =>
  `https://www.youtube.com/watch?v=${v.id}${v.start ? `&t=${v.start}s` : ""}`;
