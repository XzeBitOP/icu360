import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getModules, getModule } from "@/lib/content";
import { PageHeader, Main } from "@/components/Shell";
import { QuizRunner, type QuizQ } from "@/components/client/QuizRunner";
import { muted } from "@/components/ui";

type Params = { moduleId: string };
export function generateStaticParams(): Params[] {
  return getModules().map((m) => ({ moduleId: m.id }));
}
export const dynamicParams = false;
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const m = getModule((await params).moduleId);
  return m ? { title: `Quiz · ${m.title}` } : {};
}

export default async function ModuleQuiz({ params }: { params: Promise<Params> }) {
  const m = getModule((await params).moduleId);
  if (!m) notFound();
  const questions: QuizQ[] = m.topics.flatMap((t) =>
    t.quiz.map((q) => ({ id: `${t.id}-${q.id}`, stem: q.stem, options: q.options, answerIndex: q.answerIndex, explanation: q.explanation, source: { label: `Read: ${t.title}`, href: `/m/${m.id}/${t.id}` } }))
  );
  return (
    <>
      <PageHeader backHref={`/m/${m.id}`} eyebrow={`Module ${m.number} quiz`} title={m.title} meta={<p className={`text-[13px] ${muted} mt-2`}>{questions.length} questions from all {m.topics.length} topics. Score 70% or more and open every topic to complete the module.</p>} />
      <Main className="max-w-[640px]">
        <QuizRunner questions={questions} moduleId={m.id} doneHref={`/m/${m.id}`} doneLabel="Back to module" />
      </Main>
    </>
  );
}
