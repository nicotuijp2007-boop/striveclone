import { useEffect, useState } from "react";

/** Numeric input that allows transient empty/partial text while typing. */
export function NumberField({
  value, onChange, step = 1, min = 0, label, className = "",
}: { value: number; onChange: (n: number) => void; step?: number; min?: number; label: string; className?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={`input num ${className}`}
      inputMode="decimal"
      aria-label={label}
      value={text}
      step={step}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        setText(t);
        const n = Number(t);
        if (t !== "" && Number.isFinite(n) && n >= min) onChange(n);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
