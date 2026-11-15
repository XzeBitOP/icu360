import type { Metadata } from "next";
import { PageHeader, Main } from "@/components/Shell";
import { Callout } from "@/components/ui";
import { AntimicrobialList } from "@/components/client/AntimicrobialList";
import { ROWS } from "@/lib/antimicrobials";

export const metadata: Metadata = {
  title: "Antimicrobials",
  description: "Searchable ICU antimicrobial reference: antibacterials, antivirals, antifungals and antiparasitics with adult, ICU, renal and hepatic doses and Indian brands.",
};

export default function AntimicrobialsPage() {
  return (
    <>
      <PageHeader backHref="/browse" eyebrow={`${ROWS.length} drugs · 4 groups`} title="Antimicrobials" />
      <Main className="space-y-5 max-w-[760px]">
        <Callout kind="warn" title="Verify before prescribing" text="Verify doses against local formulary and current labels." />
        <AntimicrobialList rows={ROWS} />
      </Main>
    </>
  );
}
