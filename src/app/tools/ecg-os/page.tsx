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

const DESCRIPTION = "ECG OS: an interactive ECG and cardiac conduction simulator with a 12-lead ECG computed from the simulated beat, a 3D cutaway heart, the conduction system, AV and bundle branch blocks.";

export const metadata: Metadata = pageMeta({
  title: "ECG OS: ECG and conduction simulator",
  description: DESCRIPTION,
  path: "/tools/ecg-os",
});

export default function EcgOsPage() {
  return (
    <>
      <ViewTracker keys={["tool:ecg-os"]} />
      <JsonLd data={simulatorJsonLd({ name: "ECG OS", description: DESCRIPTION, path: "/tools/ecg-os" })} />
      <PageHeader backHref="/tools" eyebrow="Interactive simulator" title="ECG OS" right={<SavedButton item={{ href: "/tools/ecg-os", title: "ECG OS", sub: "Interactive simulator", icon: "heart-pulse" }} />} meta={<div className="mt-3"><Views n={getViews().tools["ecg-os"]} /></div>} />
      <Main className="space-y-5 max-w-[1500px]">
        <div data-no-swipe-back=""><EcgApp /></div>
        <Callout kind="info" title="For learning, not for diagnosis">
          Waveforms come from a simplified model of the conduction system and an equivalent heart dipole, so real ECG morphology will differ. The 3D heart is a schematic cutaway. Atrial fibrillation and ventricular tachycardia are not simulated yet.
        </Callout>
      </Main>
    </>
  );
}
