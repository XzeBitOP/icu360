import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { PageHeader, Main } from "@/components/Shell";
import { SearchView } from "@/components/client/SearchView";
import { QUICK } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Search",
  description: "Search 40 ICU modules, drugs, algorithms and 50 calculators.",
  path: "/search",
  index: false,
  follow: true,
});

export default function SearchPage() {
  return (
    <>
      <PageHeader backHref="/" title="Search" />
      <Main className="max-w-[720px]"><SearchView quick={QUICK} /></Main>
    </>
  );
}
