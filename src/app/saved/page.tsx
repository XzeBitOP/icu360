import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { PageHeader, Main } from "@/components/Shell";
import { SavedView } from "@/components/client/SavedView";

export const metadata: Metadata = pageMeta({
  title: "Saved and progress",
  description: "Topics and tools you have saved on this device.",
  path: "/saved",
  index: false,
  follow: false,
});

export default function SavedPage() {
  return (
    <>
      <PageHeader back={false} eyebrow="On this device" title="Saved" />
      <Main className="space-y-6 max-w-[720px]"><SavedView /></Main>
    </>
  );
}
