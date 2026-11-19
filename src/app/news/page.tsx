import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getNews, getModule } from "@/lib/content";
import { PageHeader, Main } from "@/components/Shell";
import { NewsFeed } from "@/components/client/NewsFeed";
import Link from "next/link";
import { Flame, ChevronRight } from "lucide-react";

export const metadata: Metadata = pageMeta({
  title: "Critical care news",
  description: "Guideline updates, landmark trials and Indian ICU news, picked by a critical care consultant and linked to the original source.",
  path: "/news",
});

export default function NewsPage() {
  const items = getNews().map((n) => ({ ...n, moduleTitle: n.moduleId ? getModule(n.moduleId)?.title : undefined }));
  return (
    <>
      <PageHeader back={false} eyebrow="Critical care updates" title="News" />
      <Main className="space-y-4">
        <Link href="/quiz" className="glass rounded-[22px] p-3.5 flex items-center gap-3">
          <span className="w-10 h-10 rounded-[14px] grid place-items-center text-white" style={{ background: "linear-gradient(160deg,#FDB022,#F97316)" }}><Flame className="w-5 h-5" aria-hidden="true" /></span>
          <div className="flex-1"><p className="font-semibold text-[14.5px]">Daily quiz</p><p className="text-[12.5px] text-ink-500 dark:text-night-muted">5 questions a day · keep your streak alive</p></div>
          <ChevronRight className="w-4 h-4 text-ink-400" aria-hidden="true" />
        </Link>
        <NewsFeed items={items} />
      </Main>
    </>
  );
}
