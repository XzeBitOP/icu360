import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Main } from "@/components/Shell";
import { Callout, Views, muted } from "@/components/ui";
import { VentPlayground } from "@/components/client/VentPlayground";
import { SavedButton } from "@/components/client/SavedButton";
import { ViewTracker } from "@/components/client/Tracking";
import { getViews } from "@/lib/content";

export const metadata: Metadata = { title: "Ventilator playground", description: "Move the dials and watch pressure, flow and volume waveforms, plateau, driving pressure and auto-PEEP change live." };

export default function VentPage() {
  return (
    <>
      <ViewTracker keys={["tool:ventilator"]} />
      <PageHeader backHref="/tools" eyebrow="Interactive tool" title="Ventilator playground" right={<SavedButton item={{ href: "/tools/ventilator", title: "Ventilator playground", sub: "Interactive tool", icon: "gauge" }} />} meta={<div className="mt-3"><Views n={getViews().tools["ventilator"]} /></div>} />
      <Main className="space-y-5 max-w-[760px]">
        <VentPlayground />
        <Callout kind="info" title="For learning, not for setting a real ventilator">
          A single-compartment lung (one compliance, one resistance, passive expiration, no patient effort). Real patients have uneven lungs, leaks and their own breathing. Plateau and driving pressure assume an end-inspiratory pause. Use it to understand the curves, then go to <Link href="/m/mechanical-ventilation/initial-settings" className="underline">Mechanical ventilation: initial settings</Link>.
        </Callout>
        <p className={`text-[12px] ${muted} px-1 leading-relaxed`}>Equation of motion: Paw = PEEP + flow × resistance + volume ÷ compliance. Time constant τ = R × C; expiration needs about 3–5 τ to finish, or gas is trapped (auto-PEEP). PBW = 50 (men) or 45.5 (women) + 0.91 × (height − 152.4 cm).</p>
      </Main>
    </>
  );
}
