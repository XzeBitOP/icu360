import { HeartPulse, Calculator, Brain, Zap, Star, FileText, GitBranch, BookOpen, Droplets, Wind, Gauge, FlaskConical, Timer, Activity, Pill, type LucideIcon } from "lucide-react";

/** Small icon set for client components (keeps the client bundle free of the full Lucide library). */
export const CLIENT_ICONS: Record<string, LucideIcon> = {
  "heart-pulse": HeartPulse, calculator: Calculator, brain: Brain, zap: Zap, star: Star, "file-text": FileText, "git-branch": GitBranch,
  "book-open": BookOpen, droplets: Droplets, wind: Wind, gauge: Gauge, "flask-conical": FlaskConical, timer: Timer, activity: Activity, pill: Pill,
};
export const clientIcon = (n: string) => CLIENT_ICONS[n] ?? FileText;

export function ClientIcon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const I = CLIENT_ICONS[name] ?? FileText;
  return <I className={className} strokeWidth={2} aria-hidden="true" />;
}
