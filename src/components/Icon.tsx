import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Server-side icon by Lucide kebab-case name (content uses names like "heart-pulse"). */
const pascal = (s: string) => s.split("-").map((w) => (w ? w[0].toUpperCase() + w.slice(1) : "")).join("");

export function Icon({ name, className = "w-5 h-5", strokeWidth = 1.75 }: { name: string; className?: string; strokeWidth?: number }) {
  const lib = Lucide as unknown as Record<string, LucideIcon>;
  const Cmp = lib[pascal(name)] ?? lib[`${pascal(name)}Icon`] ?? Lucide.Circle;
  return <Cmp className={`shrink-0 ${className}`} strokeWidth={strokeWidth} aria-hidden="true" />;
}
