import type { ReactNode, CSSProperties } from "react";
import { MODEL_DISCLAIMER } from "@/sim/types";

export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="a1" /><span className="a2" /><span className="a3" />
    </div>
  );
}

export function GlassCard({ title, children, className = "", style, blur = false }: { title?: string; children: ReactNode; className?: string; style?: CSSProperties; blur?: boolean }) {
  return (
    <section className={`sim-glass card ${blur ? "sim-blur" : ""} ${className}`} style={style}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

export function Chip({ children, tone, pressed, onClick, title }: { children: ReactNode; tone?: "warn" | "ok" | "crit"; pressed?: boolean; onClick?: () => void; title?: string }) {
  if (onClick) return <button type="button" className={`chip ${tone ?? ""}`} aria-pressed={pressed} onClick={onClick} title={title}>{children}</button>;
  return <span className={`chip ${tone ?? ""}`} title={title}>{children}</span>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Field({ id, label, value, min, max, step, unit, onChange, hint, format }: { id: string; label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void; hint?: string; format?: (v: number) => string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <output htmlFor={id}>{format ? format(value) : value}{unit ? ` ${unit}` : ""}</output>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Stat({ label, value, unit, note, invalid, flag, testId }: { label: string; value: string; unit?: string; note?: string; invalid?: boolean; flag?: boolean; testId?: string }) {
  return (
    <div className={`stat ${invalid ? "invalid" : ""} ${flag ? "flag" : ""}`} data-testid={testId}>
      <span className="k">{label}</span>
      <span className="v tnum">{value}{unit ? <span className="u">{unit}</span> : null}</span>
      {note ? <span className="n">{note}</span> : null}
    </div>
  );
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return <div className="disclaimer" role="note"><b>Educational model.</b> {children ?? MODEL_DISCLAIMER}</div>;
}
