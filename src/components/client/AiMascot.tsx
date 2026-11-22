"use client";
import { useId } from "react";

/**
 * ICU 360 AI tutor mascot: a white ball with two long, dark, slanted pill eyes in the upper right (no mouth).
 * Soft shading + thin edge so it reads on light and dark glass. Blinks now and then; bobs while `active` (AI streaming).
 * Both animations are off under prefers-reduced-motion (see globals.css).
 */
export function AiMascot({ size = 16, active = false, sheen = true, label = "Ask AI", className = "" }: { size?: number; active?: boolean; sheen?: boolean; label?: string | null; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={`ai-mascot ${active ? "is-active" : ""} ${className}`} data-testid="ai-mascot"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })} focusable="false" style={{ flexShrink: 0, overflow: "visible" }}>
      <defs>
        <radialGradient id={`b${id}`} cx="0.38" cy="0.3" r="0.78">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".62" stopColor="#f7f8fa" />
          <stop offset="1" stopColor={sheen ? "#dfe4ea" : "#f4f5f7"} />
        </radialGradient>
        <radialGradient id={`s${id}`} cx="0.3" cy="0.2" r="0.42">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="ai-mascot-body">
        <circle cx="256" cy="256" r="232" fill={`url(#b${id})`} stroke="rgba(15,23,42,.16)" strokeWidth="10" />
        {sheen ? <ellipse cx="190" cy="150" rx="120" ry="78" fill={`url(#s${id})`} transform="rotate(-28 190 150)" /> : null}
        <g fill="#1a1a1a">
          <g transform="translate(268 212) rotate(-24)"><rect className="ai-mascot-eye" x="-23" y="-70" width="46" height="140" rx="23" /></g>
          <g transform="translate(362 180) rotate(-24)"><rect className="ai-mascot-eye" x="-20" y="-60" width="40" height="120" rx="20" /></g>
        </g>
      </g>
    </svg>
  );
}
