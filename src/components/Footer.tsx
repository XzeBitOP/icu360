import Link from "next/link";
import QRCode from "qrcode";
import { SITE, UPI_LINK } from "@/lib/site";
import { DonateButton } from "./client/Donate";
import { Books } from "./client/Books";

export async function Footer() {
  const qr = await QRCode.toString(UPI_LINK, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0B1726", light: "#FFFFFF" } });
  return (
    <footer className="mt-10 space-y-4" aria-label="Footer">
      <section className="glass rounded-[26px] p-5">
        <div className="flex items-start gap-4">
          <span className="w-11 h-11 rounded-[14px] grid place-items-center text-[22px] shrink-0" style={{ background: "linear-gradient(160deg,#FDB022,#F97316)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.45),0 8px 18px -8px rgba(249,115,22,.6)" }} aria-hidden="true">
            ☕
          </span>
          <div className="flex-1 min-w-0">
            <p className="display font-semibold text-[17px] leading-snug">Keeping ICU 360 alive costs more than a night shift&apos;s worth of chai. Chip in?</p>
            <p className="text-[13px] text-ink-500 dark:text-night-muted mt-1 leading-relaxed">No ads, no paywall, no drug-rep lunches. Just caffeine-powered updates at 3 am. Any amount keeps the servers awake (unlike us after a 36-hour call).</p>
          </div>
        </div>
        <DonateButton upiLink={UPI_LINK} upiId={SITE.upiId} qrSvg={qr} />
      </section>

      <Books />

      <div className="px-1 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
        <p className="text-[11.5px] uppercase tracking-[.1em] font-semibold text-ink-400 dark:text-night-faint">From the makers of</p>
        <div className="flex items-center gap-5">
          {SITE.cobrands.map((b) => (
            <a key={b.name} href={b.href} target="_blank" rel="noopener" className="group inline-flex items-center gap-2 text-[13px] font-semibold text-ink-400 dark:text-night-faint hover:text-ink-700 dark:hover:text-night-text transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.logo} alt="" width={20} height={20} loading="lazy" className="w-5 h-5 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition" />
              {b.name}
            </a>
          ))}
        </div>
      </div>

      <p className="px-1 text-[12px] leading-relaxed text-ink-500 dark:text-night-muted">
        <b className="font-semibold text-ink-700 dark:text-night-text">Medical disclaimer.</b> ICU 360 is an educational reference for trained clinicians. It does not replace clinical judgement, your hospital&apos;s protocols or a senior&apos;s advice. Check every dose against your local formulary and the patient in front of you. No patient data is collected; your progress stays on your device.
      </p>
      <p className="px-1 text-[12px] leading-relaxed text-ink-500 dark:text-night-muted">
        <b className="font-semibold text-ink-700 dark:text-night-text">Video credits.</b> Embedded videos by Armando Hasudungan (
        <a href="https://armandoh.org" target="_blank" rel="noopener" className="font-semibold text-brand-600 dark:text-glow-teal">armandoh.org</a>). We do not own these videos; all rights belong to Armando Hasudungan. Other embedded YouTube videos are credited to their channels on each video; all rights belong to their creators.{" "}
        <Link href="/credits" className="font-semibold text-brand-600 dark:text-glow-teal">All video credits</Link>
      </p>
      <p className="px-1 pb-2 text-[11.5px] text-ink-400 dark:text-night-faint">© {new Date().getFullYear()} ICU 360 · Made in India for night shifts everywhere.</p>
    </footer>
  );
}
