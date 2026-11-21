import type { Metadata } from "next";
import { pageMeta, simulatorJsonLd } from "@/lib/seo";
import { PageHeader, Main } from "@/components/Shell";
import { Callout, Views } from "@/components/ui";
import { EcgApp } from "@/components/sim/ecg/EcgApp";
import "@/components/sim/sim.css";
import { JsonLd } from "@/components/JsonLd";
import { SavedButton } from "@/components/client/SavedButton";
import { ViewTracker } from "@/components/client/Tracking";
import { getViews } from "@/lib/content";
import { ECG_FAQS, getGuide } from "@/lib/learn";
import { FaqList, GuideSections, LinkGrid } from "@/components/LearnBlocks";

const DESCRIPTION = "ECG OS is a free interactive ECG simulator: learn ECG online by watching the impulse cross a 3D heart while the 12-lead ECG builds from the same beat. Sinus rhythms, AV blocks and bundle branch blocks, with measured PR, QRS and QTc.";

export const metadata: Metadata = pageMeta({
  title: "Free ECG simulator online: learn ECG interactively",
  description: DESCRIPTION,
  path: "/tools/ecg-os",
});

export default function EcgOsPage() {
  return (
    <>
      <ViewTracker keys={["tool:ecg-os"]} />
      <JsonLd data={simulatorJsonLd({ name: "ECG OS", description: DESCRIPTION, path: "/tools/ecg-os", faqs: ECG_FAQS, teaches: getGuide("ecg")!.teaches })} />
      <PageHeader backHref="/tools" eyebrow="Free interactive ECG simulator" title="ECG OS" right={<SavedButton item={{ href: "/tools/ecg-os", title: "ECG OS", sub: "Interactive simulator", icon: "heart-pulse" }} />} meta={<div className="mt-3"><Views n={getViews().tools["ecg-os"]} /></div>} />
      <Main className="space-y-5 max-w-[1500px]">
        <div data-no-swipe-back=""><EcgApp /></div>
        <Callout kind="info" title="For learning, not for diagnosis">
          Waveforms come from a simplified model of the conduction system and an equivalent heart dipole, so real ECG morphology will differ. The 3D heart is a schematic cutaway. Atrial fibrillation and ventricular tachycardia are not simulated yet.
        </Callout>
        <SeoBlock />
      </Main>
    </>
  );
}

/** Crawlable "what you can learn" and FAQ under the simulator (server-rendered). */
function SeoBlock() {
  const g = getGuide("ecg")!;
  const practise = g.sections.filter((s) => s.id === "practise").map((s) => ({ ...s, h: "What you can learn in ECG OS" }));
  return (
    <div className="space-y-5 max-w-[860px]">
      <GuideSections sections={practise} />
      <LinkGrid title="Learn ECG step by step" links={[{ href: g.path, title: "Learn ECG interpretation", sub: "Free guide: waves, intervals, a systematic read", icon: "book-open" }, ...g.links.slice(0, 3)]} />
      <FaqList faqs={ECG_FAQS} />
    </div>
  );
}
