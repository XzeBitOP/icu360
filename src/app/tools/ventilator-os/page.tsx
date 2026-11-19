import type { Metadata } from "next";
import { pageMeta, simulatorJsonLd } from "@/lib/seo";
import Link from "next/link";
import { PageHeader, Main } from "@/components/Shell";
import { Callout, Views, muted } from "@/components/ui";
import { VentApp } from "@/components/sim/vent/VentApp";
import "@/components/sim/sim.css";
import { JsonLd } from "@/components/JsonLd";
import { SavedButton } from "@/components/client/SavedButton";
import { ViewTracker } from "@/components/client/Tracking";
import { getViews } from "@/lib/content";

const DESCRIPTION = "Ventilator OS: an interactive mechanical ventilation simulator with live pressure, flow and volume waveforms, plateau, driving pressure and auto-PEEP, a five-lobe 3D lung, ARDS, COPD and one-lung scenarios.";

export const metadata: Metadata = pageMeta({
  title: "Ventilator OS: mechanical ventilation simulator",
  description: DESCRIPTION,
  path: "/tools/ventilator-os",
});

export default function VentilatorOsPage() {
  const tools = getViews().tools;
  return (
    <>
      <ViewTracker keys={["tool:ventilator-os"]} />
      <JsonLd data={simulatorJsonLd({ name: "Ventilator OS", description: DESCRIPTION, path: "/tools/ventilator-os" })} />
      <PageHeader backHref="/tools" eyebrow="Interactive simulator" title="Ventilator OS" right={<SavedButton item={{ href: "/tools/ventilator-os", title: "Ventilator OS", sub: "Interactive simulator", icon: "gauge" }} />} meta={<div className="mt-3"><Views n={tools["ventilator-os"] ?? tools["ventilator"]} /></div>} />
      <Main className="space-y-5 max-w-[1500px]">
        <div data-no-swipe-back=""><VentApp /></div>
        <Callout kind="info" title="For learning, not for setting a real ventilator">
          A simplified five-lobe lung (each lobe has its own compliance, resistance and closing pressure), with passive or patient-triggered breaths. Real patients have leaks, secretions and their own drive. Plateau and driving pressure need an inspiratory hold, and the model will not show them without one. Then see <Link href="/m/mechanical-ventilation/initial-settings" className="underline">Mechanical ventilation: initial settings</Link>.
        </Callout>
        <p className={`text-[12px] ${muted} px-1 leading-relaxed`}>Equation of motion: Paw = PEEP + flow × resistance + volume ÷ compliance. Time constant τ = R × C; expiration needs about 3–5 τ to finish, or gas is trapped (auto-PEEP). PBW = 50 (men) or 45.5 (women) + 0.91 × (height − 152.4 cm).</p>
      </Main>
    </>
  );
}
