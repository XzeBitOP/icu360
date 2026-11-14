import type { Metadata } from "next";
import { PageHeader, Main } from "@/components/Shell";
import { SavedView } from "@/components/client/SavedView";

export const metadata: Metadata = { title: "Saved and progress" };

export default function SavedPage() {
  return (
    <>
      <PageHeader back={false} eyebrow="On this device" title="Saved" />
      <Main className="space-y-6 max-w-[720px]"><SavedView /></Main>
    </>
  );
}
