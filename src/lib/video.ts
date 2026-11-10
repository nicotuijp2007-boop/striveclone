import type { AppState, VideoRef } from "../types";

/** A default form video for a built-in exercise, with the channel it's from. */
export interface DefaultVideo extends VideoRef {
  channel: string;
}

/**
 * Form videos for the built-in exercises. Each was checked with YouTube's oEmbed endpoint to exist,
 * allow embedding, and come from the channel listed. Users can swap any of them in the app.
 */
export const DEFAULT_VIDEOS: Record<string, DefaultVideo> = {
  bench: { id: "gRVjAtPip0Y", channel: "Buff Dudes" },
  "incline-db": { id: "sh5ZsRpEZCw", channel: "All Strength Training" },
  pushup: { id: "M7fWdJlDxPQ", channel: "Insider Tech" },
  deadlift: { id: "xkb5_v6t8xI", channel: "Liberate Strength" },
  row: { id: "A1tmBJKKfVs", channel: "Barbell Logic" },
  pullup: { id: "9yVGh3XbJ34", channel: "NASM" },
  "lat-pulldown": { id: "rpkWBC1gCcE", channel: "Tim Bullici" },
  squat: { id: "QLbMsabhBqY", channel: "Syracuse Fitness Center" },
  rdl: { id: "7j-2w4-P14I", channel: "Nuffield Health" },
  "leg-press": { id: "cDGOn-yfKJA", channel: "NASM" },
  lunge: { id: "qLyj6xo3j5c", channel: "Quadzilla Hikes" },
  ohp: { id: "3VpI0V_9D0Y", channel: "All Strength Training" },
  "lateral-raise": { id: "Y29xKcze8Ik", channel: "Physique Development" },
  curl: { id: "9BpYNH4nb_Q", channel: "All Strength Training" },
  "tricep-pushdown": { id: "ChbWX35gD44", channel: "Fitness Freek" },
  plank: { id: "mwlp75MS6Rg", channel: "NASM" },
  "hanging-leg-raise": { id: "ByPKcOzBH1g", channel: "Fitness By Physio" },
  "kb-swing": { id: "B_x0tp3HIbk", channel: "Brandon Palmer" },
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
