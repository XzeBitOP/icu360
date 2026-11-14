import type { Metadata } from "next";
import { PageHeader, Main } from "@/components/Shell";
import { ProgressView } from "@/components/client/ProgressView";

export const metadata: Metadata = { title: "Your progress", description: "Modules completed, badges and offline download. Stored on your device only." };

export default function ProgressPage() {
  return (
    <>
      <PageHeader backHref="/saved" eyebrow="Stored on this device" title="Your progress" />
      <Main className="space-y-6 max-w-[720px]"><ProgressView /></Main>
    </>
  );
}
