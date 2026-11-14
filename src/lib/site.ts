export const SITE = {
  name: "ICU 360",
  tagline: "Critical care, at the bedside",
  description: "Free ICU reference for junior doctors and interns: bedside cards, step-by-step algorithms, drug doses, calculators and consultant notes for Indian ICUs.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://icu360.in",
  upiId: "xzecure2022@ybl",
  upiName: "ICU 360",
  cobrands: [
    { name: "XzeCure.com", href: "https://xzecure.com", logo: "/brand/xzecure.png" },
    { name: "ObeCure.com", href: "https://obecure.com", logo: "/brand/obecure.png" },
  ],
};

export const UPI_LINK = `upi://pay?pa=${SITE.upiId}&pn=${encodeURIComponent(SITE.upiName)}&cu=INR`;

export const QUICK = [
  { label: "Cardiac arrest", href: "/m/cardiac-arrest-post-rosc/als-shockable", urgent: true },
  { label: "Septic shock", href: "/m/sepsis-septic-shock/hour-1-bundle" },
  { label: "Hyperkalaemia", href: "/m/fluids-electrolytes/hyperkalaemia" },
  { label: "Status epilepticus", href: "/m/neuro-emergencies/status-epilepticus" },
  { label: "OP poisoning", href: "/m/agrochemical-household-poisons/organophosphate-carbamate" },
  { label: "Snakebite", href: "/m/snakebite-scorpion-envenomation/snakebite-syndromes" },
];
