"use client";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Check, X, HeartHandshake, Smartphone } from "lucide-react";
import { useState } from "react";

export function DonateButton({ upiLink, upiId, qrSvg }: { upiLink: string; upiId: string; qrSvg: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const onClick = () => {
    const mobile = window.matchMedia("(pointer: coarse)").matches && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (mobile) window.location.href = upiLink;
    else setOpen(true);
  };
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onClick} className="h-12 px-6 rounded-full text-white text-[14px] font-semibold inline-flex items-center gap-2"
          style={{ background: "linear-gradient(135deg,#0F6B7A,#1B4FA0)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3),0 10px 24px -10px rgba(27,79,160,.7)" }}>
          <HeartHandshake className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
          Donate via UPI
        </button>
        <span className="text-[12px] text-ink-500 dark:text-night-muted">Opens your UPI app on phones · QR code on desktop</span>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center p-4 bg-ink-900/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label="Donate with UPI">
            <motion.div className="glass-strong rounded-[28px] p-6 w-full max-w-[360px] text-center" initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end -mt-2 -mr-2">
                <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="glass-btn w-9 h-9 grid place-items-center rounded-full">
                  <X className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
              <p className="display text-[20px] font-semibold">Scan with any UPI app</p>
              <p className="text-[13px] text-ink-500 dark:text-night-muted mt-1">GPay, PhonePe, Paytm, BHIM…</p>
              <div className="mx-auto mt-4 w-[220px] h-[220px] rounded-[20px] overflow-hidden bg-white p-2 [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <button type="button" className="mt-4 inline-flex items-center gap-2 glass-chip rounded-full px-3.5 py-1.5 font-mono text-[13px] font-semibold"
                onClick={async () => { try { await navigator.clipboard.writeText(upiId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>
                {upiId}
                {copied ? <Check className="w-3.5 h-3.5 text-ok" strokeWidth={2.4} aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" />}
              </button>
              <a href={upiLink} className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-brand-600 dark:text-glow-teal">
                <Smartphone className="w-4 h-4" strokeWidth={2} aria-hidden="true" /> On a phone? Open the UPI app
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
