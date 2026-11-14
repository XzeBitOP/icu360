import Link from "next/link";
import { Search, Mic, Siren, Timer, ChevronRight, Trophy } from "lucide-react";
import { getModules, getNews, getSections, getViews, getTopic, sectionViews, viewsByHref, getDailyQuiz } from "@/lib/content";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/client/ThemeToggle";
import { Greeting } from "@/components/client/Greeting";
import { HomeFavourites, QuizAndProgress, type FavDefault } from "@/components/client/HomeWidgets";
import { Chip, H2, IconTile, Views, muted } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { QUICK } from "@/lib/site";
import { istDate, prettyDate } from "@/lib/format";

const DEFAULT_FAVS: FavDefault[] = [
  { href: "/m/sepsis-septic-shock/hour-1-bundle", title: "Septic shock", sub: "Bedside card", icon: "heart-pulse" },
  { href: "/tools/infusion-rate-weight-min", title: "Noradrenaline", sub: "Infusion calculator", icon: "calculator" },
  { href: "/tools/gcs", title: "GCS", sub: "Score", icon: "brain" },
  { href: "/m/fluids-electrolytes/hyperkalaemia", title: "Hyperkalaemia", sub: "Algorithm", icon: "zap" },
];

const tagCls: Record<string, string> = { Guideline: "text-brand-700 dark:text-glow-teal", Trial: "text-info dark:text-info-bright", India: "text-warn dark:text-warn-bright", "Drug safety": "text-crit dark:text-crit-bright", Definition: "text-pearl dark:text-pearl-bright" };

function TopTopicCard() {
  const v = getViews();
  const tt = v.topTopic ? getTopic(v.topTopic.moduleId, v.topTopic.topicId) : undefined;
  const pick = tt ?? getTopic("sepsis-septic-shock", "hour-1-bundle")!;
  const isTop = !!tt;
  return (
    <Link href={`/m/${pick.module.id}/${pick.topic.id}`} className="glass rounded-[26px] p-4 flex items-center gap-3.5">
      <span className="w-12 h-12 rounded-[16px] grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(160deg,#FDB022,#F97316)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.45),0 8px 18px -8px rgba(249,115,22,.6)" }}>
        <Trophy className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[11.5px] uppercase tracking-[.1em] font-semibold text-warn dark:text-warn-bright">{isTop ? "Top topic of the week" : "Editor's pick this week"}</p>
        <p className="font-semibold text-[16px] leading-snug mt-0.5 truncate">{pick.topic.title}</p>
        <p className={`text-[12.5px] ${muted} truncate`}>{pick.module.title}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-ink-400 dark:text-night-muted" strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}

function NewsList({ limit, compact = false }: { limit: number; compact?: boolean }) {
  const news = getNews().slice(0, limit);
  if (!news.length)
    return (
      <div className={`glass rounded-[24px] p-4 ${compact ? "" : ""}`}>
        <p className="font-semibold text-[15px]">Daily critical care updates start here</p>
        <p className={`text-[13px] ${muted} mt-1 leading-relaxed`}>Guideline changes, landmark trials and Indian ICU news, picked by a critical care consultant and linked to the original source.</p>
      </div>
    );
  return (
    <div className="glass rounded-[24px] divide-y divide-ink-200/60 dark:divide-white/10">
      {news.map((n) => (
        <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer" className="block p-4">
          <div className={`flex items-center gap-2 text-[12px] ${muted}`}>
            <Chip className={tagCls[n.tag] ?? "text-ink-700 dark:text-night-muted"}>{n.tag}</Chip>
            {!compact && <span className="truncate">{n.source}</span>}
            {!compact && <span>·</span>}
            <span className="whitespace-nowrap">{prettyDate(n.date)}</span>
          </div>
          <h3 className={`font-semibold ${compact ? "text-[13.5px]" : "text-[15px]"} leading-snug mt-2`}>{n.title}</h3>
        </a>
      ))}
    </div>
  );
}

export default function Home() {
  const sections = getSections();
  const modules = getModules();
  const views = viewsByHref();
  const hasQuizToday = getDailyQuiz().some((s) => s.date === istDate());
  const tools = [
    { href: "/tools/infusion-rate-weight-min", icon: "calculator", t: "Infusion calculator", s: "mcg/kg/min ↔ mL/h" },
    { href: "/tools/ventilator", icon: "gauge", t: "Ventilator playground", s: "Live waveforms" },
    { href: "/tools/abg", icon: "droplets", t: "ABG interpreter", s: "Stepwise, with AG and delta" },
    { href: "/tools/gcs", icon: "brain", t: "GCS", s: "E · V · M" },
  ];
  const topics = modules.reduce((n, m) => n + m.topics.length, 0);

  return (
    <>
      {/* ---------------- Mobile / tablet ---------------- */}
      <div className="lg:hidden">
        <header className="px-5 pt-5 flex items-center gap-3">
          <Logo size={42} />
          <div className="flex-1">
            <p className="display text-[21px] font-bold leading-none">ICU 360</p>
            <p className={`text-[12.5px] ${muted} mt-1`}>Critical care, at the bedside</p>
          </div>
          <ThemeToggle />
        </header>
        <main className="px-4 pt-5 pb-4 space-y-7">
          <div>
            <h1 className="display text-[34px] font-bold leading-[1.05] px-1">
              <Greeting />
              <br />
              <span className="bg-clip-text text-transparent dark:hidden" style={{ backgroundImage: "linear-gradient(90deg,#0F7C8C,#2554C7 55%,#6B3FCB)" }}>What&apos;s on the shift?</span>
              <span className="hidden dark:inline bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg,#5EEAD4,#7DD3FC 50%,#C4B5FD)" }}>What&apos;s on the shift?</span>
            </h1>
            <Link href="/search" className="mt-5 glass blur-glass flex items-center gap-3 h-[52px] px-4 rounded-full text-ink-400 dark:text-night-muted">
              <Search className="w-5 h-5" strokeWidth={2.1} aria-hidden="true" />
              <span className="text-[15px] flex-1">Search modules, drugs, calculators</span>
              <Mic className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
            </Link>
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar -mx-4 px-4">
              {QUICK.map((q) => (
                <Link key={q.href} href={q.href} className={`glass-chip shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold flex items-center gap-1.5 ${q.urgent ? "text-crit dark:text-crit-bright" : "text-ink-700 dark:text-night-text"}`}>
                  {q.urgent ? <Siren className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" /> : null}
                  {q.label}
                </Link>
              ))}
            </div>
          </div>

          <Link href="/tools/code-timer" className="glass-hero blur-glass rounded-[28px] p-5 block">
            <div className="flex items-center gap-4">
              <span className="w-14 h-14 rounded-[18px] grid place-items-center" style={{ background: "rgba(255,255,255,.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
                <Timer className="w-7 h-7" strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="flex-1">
                <p className="display font-semibold text-[19px]">Code timer</p>
                <p className="text-[13px] text-white/75">ACLS cycles, adrenaline and rhythm-check prompts</p>
              </div>
              <span className="w-9 h-9 rounded-full grid place-items-center" style={{ background: "rgba(255,255,255,.18)" }}>
                <ChevronRight className="w-5 h-5" strokeWidth={2.2} aria-hidden="true" />
              </span>
            </div>
          </Link>

          <TopTopicCard />

          <HomeFavourites defaults={DEFAULT_FAVS} views={views} variant="scroll" />

          <section>
            <H2 link={`${modules.length} modules`} href="/browse">Browse by section</H2>
            <div className="grid grid-cols-2 gap-3">
              {sections.slice(0, 6).map((s) => (
                <Link key={s.id} href={`/section/${s.slug}`} className="glass rounded-[24px] p-4 min-h-[128px] flex flex-col">
                  <IconTile name={s.icon} />
                  <p className="font-semibold text-[14px] leading-snug mt-3">{s.title}</p>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <span className={`text-[12px] ${muted}`}>{s.modules.length} modules</span>
                    <Views n={sectionViews(s)} />
                  </div>
                </Link>
              ))}
            </div>
            <Link href="/browse" className="glass-btn mt-3 w-full h-12 rounded-full text-[14px] font-semibold text-ink-700 dark:text-night-text grid place-items-center">
              Show all {sections.length} sections
            </Link>
          </section>

          <QuizAndProgress hasQuizToday={hasQuizToday} />

          <section>
            <H2 link="All news" href="/news">Latest in critical care</H2>
            <NewsList limit={2} />
          </section>
        </main>
      </div>

      {/* ---------------- Desktop ---------------- */}
      <main className="hidden lg:grid py-5 grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="space-y-6 min-w-0">
          <section className="glass-hero rounded-[32px] p-8 flex items-center gap-8">
            <div className="flex-1">
              <p className="text-[12px] uppercase tracking-[.14em] font-semibold text-white/70">{modules.length} modules · {sections.length} sections · {topics} topics</p>
              <h1 className="display text-[44px] font-bold leading-[1.02] mt-2">Critical care,<br />at the bedside.</h1>
              <p className="text-white/80 text-[15px] mt-3 max-w-[480px]">Bedside cards, step-by-step algorithms and consultant notes, built for juniors and interns on a night shift.</p>
              <div className="flex flex-wrap gap-2 mt-5">
                {QUICK.map((q) => (
                  <Link key={q.href} href={q.href} className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold text-white ${q.urgent ? "bg-crit" : ""}`}
                    style={q.urgent ? { boxShadow: "0 6px 16px -6px rgba(217,45,32,.7)" } : { background: "rgba(255,255,255,.14)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)" }}>
                    {q.label}
                  </Link>
                ))}
              </div>
            </div>
            <Link href="/tools/code-timer" className="w-[210px] shrink-0 rounded-[24px] p-5" style={{ background: "rgba(255,255,255,.14)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
              <span className="w-11 h-11 rounded-[14px] grid place-items-center" style={{ background: "rgba(255,255,255,.18)" }}>
                <Timer className="w-6 h-6" strokeWidth={2} aria-hidden="true" />
              </span>
              <p className="display font-semibold text-[18px] mt-3">Code timer</p>
              <p className="text-[12.5px] text-white/75 mt-0.5">ACLS cycles and drug prompts</p>
            </Link>
          </section>
          <section>
            <div className="flex items-baseline justify-between mb-3 px-1">
              <h2 className="display text-[22px] font-semibold">Browse by section</h2>
              <Link href="/browse" className="text-[13px] font-semibold text-brand-600 dark:text-glow-teal">View all modules</Link>
            </div>
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
              {sections.map((s) => (
                <Link key={s.id} href={`/section/${s.slug}`} className="glass rounded-[24px] p-4 flex flex-col min-h-[128px]">
                  <IconTile name={s.icon} />
                  <p className="font-semibold text-[14px] leading-snug mt-3">{s.title}</p>
                  <div className="flex items-center justify-between mt-auto pt-1.5">
                    <span className={`text-[12px] ${muted}`}>{s.modules.length} modules</span>
                    <Views n={sectionViews(s)} />
                  </div>
                </Link>
              ))}
              <div className={`glass rounded-[24px] p-4 flex flex-col justify-center text-[13px] ${muted}`}>
                <p className="font-semibold text-ink-900 dark:text-night-text">All 3 phases live</p>
                <p className="mt-1">{modules.length} modules and {topics} topics, updated as guidelines change.</p>
              </div>
            </div>
          </section>
          <section>
            <h2 className="display text-[22px] font-semibold mb-3 px-1">Tools</h2>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {tools.map((t) => (
                <Link key={t.href} href={t.href} className="glass rounded-[22px] p-4 flex items-center gap-3">
                  <IconTile name={t.icon} isz="w-[18px] h-[18px]" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[13.5px] truncate">{t.t}</p>
                    <p className={`text-[12px] ${muted} truncate`}>{t.s}</p>
                  </div>
                  <Views n={views[t.href]} />
                </Link>
              ))}
            </div>
          </section>
          <QuizAndProgress hasQuizToday={hasQuizToday} />
        </div>
        <aside className="space-y-5">
          <TopTopicCard />
          <HomeFavourites defaults={DEFAULT_FAVS} views={views} variant="list" />
          <section className="glass rounded-[26px] p-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="display text-[17px] font-semibold">Latest in critical care</h2>
              <Link href="/news" className="text-[12.5px] font-semibold text-brand-600 dark:text-glow-teal">All</Link>
            </div>
            <div className="-mx-5 -mb-5 [&>div]:shadow-none [&>div]:bg-transparent [&>div]:before:hidden">
              <NewsList limit={3} compact />
            </div>
          </section>
          <section className="glass rounded-[26px] p-5 flex items-center gap-3">
            <Icon name="shield-check" className="w-5 h-5 text-ok dark:text-ok-bright" strokeWidth={2} />
            <p className={`text-[12.5px] ${muted} leading-relaxed`}>Content reviewed by a critical care consultant · Nov 2026</p>
          </section>
        </aside>
      </main>
    </>
  );
}
