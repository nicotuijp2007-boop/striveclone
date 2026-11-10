import { useState } from "react";
import { useApp } from "../context";
import { embedUrl, parseYouTube, videoFor, watchUrl } from "../lib/video";

/** Plays an exercise's form video and lets the user swap, remove or restore it. */
export function FormVideoSheet({ exerciseId, onClose }: { exerciseId: string; onClose: () => void }) {
  const { state, dispatch, exerciseById } = useApp();
  const name = exerciseById(exerciseId)?.name ?? "Exercise";
  const { video, channel, source, hasDefault } = videoFor(state, exerciseId);
  const [editing, setEditing] = useState(!video);
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  const save = () => {
    const ref = parseYouTube(link);
    if (!ref) return setError("That doesn't look like a YouTube link. Copy it from the Share button on YouTube.");
    dispatch({ type: "setExerciseVideo", exerciseId, video: ref });
    setLink("");
    setError(null);
    setEditing(false);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={`${name} form video`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{name}</h2>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        {video ? (
          <>
            {offline ? (
              <p className="video-frame offline muted">You're offline. Videos play when you're back online.</p>
            ) : (
              <div className="video-frame">
                <iframe
                  key={video.id}
                  src={embedUrl(video)}
                  title={`${name} form video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            )}
            <div className="split small">
              <span className="muted">
                {source === "custom" ? "Your video" : `Video by ${channel}`}
              </span>
              <a href={watchUrl(video)} target="_blank" rel="noreferrer">Open in YouTube</a>
            </div>
          </>
        ) : (
          <p className="muted">No form video for this exercise yet. Paste a YouTube link to add one.</p>
        )}

        {editing ? (
          <div className="stack">
            <input className="input" inputMode="url" placeholder="Paste a YouTube link" value={link} autoFocus
              onChange={(e) => { setLink(e.target.value); setError(null); }}
              onKeyDown={(e) => e.key === "Enter" && save()} />
            {error && <p className="error-text small">{error}</p>}
            <p className="muted small">Tip: to start at a certain moment, use YouTube's Share → "Start at".</p>
            <div className="row">
              {video && <button className="btn ghost" onClick={() => { setEditing(false); setError(null); }}>Cancel</button>}
              <button className="btn primary grow" disabled={!link.trim()} onClick={save}>Save video</button>
            </div>
          </div>
        ) : (
          <div className="row wrap">
            <button className="btn secondary sm" onClick={() => setEditing(true)}>Use a different video</button>
            {source === "custom" && hasDefault && (
              <button className="btn ghost sm" onClick={() => dispatch({ type: "setExerciseVideo", exerciseId, video: "default" })}>
                Back to default
              </button>
            )}
            <button className="btn ghost sm danger" onClick={() => { dispatch({ type: "setExerciseVideo", exerciseId, video: null }); setEditing(true); }}>
              Remove video
            </button>
          </div>
        )}
        {!video && source === "none" && hasDefault && (
          <button className="btn ghost sm" onClick={() => dispatch({ type: "setExerciseVideo", exerciseId, video: "default" })}>
            Restore the default video
          </button>
        )}
      </div>
    </div>
  );
}
