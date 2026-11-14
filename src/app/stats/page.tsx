import type { Metadata } from "next";
import { PageHeader, Main } from "@/components/Shell";
import { StatsView } from "@/components/client/StatsView";
import { MODULES, TOOLS } from "@/lib/progress";

export const metadata: Metadata = { title: "Stats", robots: { index: false, follow: false } };

export default function StatsPage() {
  const names: Record<string, string> = {};
  for (const m of MODULES) {
    names[`module:${m.id}`] = m.title;
    for (const [t, title] of m.topics) names[`topic:${m.id}/${t}`] = `${title} · ${m.title}`;
  }
  for (const t of TOOLS) names[`tool:${t.id}`] = t.name;
  return (
    <>
      <PageHeader back={false} eyebrow="Private" title="Stats" />
      <Main className="max-w-[860px]"><StatsView names={names} /></Main>
    </>
  );
}
