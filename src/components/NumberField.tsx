import { useEffect, useState } from "react";

/** Numeric input that allows transient empty/partial text while typing. */
export function NumberField({
  value, onChange, step = 1, min = 0, label, className = "", nav = false, blankZero = false, placeholder,
}: {
  value: number; onChange: (n: number) => void; step?: number; min?: number; label: string; className?: string;
  /** Show 0 as an empty field (value not filled in yet), with `placeholder` as a hint. */
  blankZero?: boolean;
  placeholder?: string;
  /** Part of a keyboard chain: Enter / "Next" moves to the next `nav` field on the page. */
  nav?: boolean;
}) {
  const show = (v: number) => (blankZero && v === 0 ? "" : String(v));
  const [text, setText] = useState(show(value));
  useEffect(() => {
    if (Number(text) !== value || (blankZero && value === 0)) setText(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={`input num ${className}`}
      inputMode="decimal"
      aria-label={label}
      value={text}
      placeholder={placeholder}
      step={step}
      enterKeyHint={nav ? "next" : undefined}
      data-nav={nav || undefined}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (!nav || e.key !== "Enter") return;
        e.preventDefault();
        const all = [...document.querySelectorAll<HTMLInputElement>("input[data-nav]")];
        const next = all[all.indexOf(e.currentTarget) + 1];
        if (next) next.focus();
        else e.currentTarget.blur();
      }}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        setText(t);
        const n = Number(t);
        if (t !== "" && Number.isFinite(n) && n >= min) onChange(n);
        else if (t === "" && blankZero) onChange(0); // cleared: back to "not filled in"
      }}
      onBlur={() => setText(show(value))}
    />
  );
}
