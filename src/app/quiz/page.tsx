import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { getDailyQuiz } from "@/lib/content";
import { PageHeader, Main } from "@/components/Shell";
import { DailyQuiz } from "@/components/client/DailyQuiz";

export const metadata: Metadata = pageMeta({
  title: "Daily quiz",
  description: "Five critical care questions a day, with explanations and references, written for junior doctors.",
  path: "/quiz",
});

export default function QuizPage() {
  const sets = getDailyQuiz();
  return (
    <>
      <PageHeader backHref="/news" eyebrow="5 questions a day" title="Daily quiz" />
      <Main className="max-w-[640px]">
        <DailyQuiz sets={sets} />
      </Main>
    </>
  );
}
