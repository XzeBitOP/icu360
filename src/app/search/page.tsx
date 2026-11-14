import type { Metadata } from "next";
import { PageHeader, Main } from "@/components/Shell";
import { SearchView } from "@/components/client/SearchView";
import { QUICK } from "@/lib/site";

export const metadata: Metadata = { title: "Search", description: "Search 40 ICU modules, drugs, algorithms and 50 calculators." };

export default function SearchPage() {
  return (
    <>
      <PageHeader backHref="/" title="Search" />
      <Main className="max-w-[720px]"><SearchView quick={QUICK} /></Main>
    </>
  );
}
