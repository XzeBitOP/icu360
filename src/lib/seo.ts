import type { Metadata } from "next";
import type { MetadataRoute } from "next";
import type { Antimicrobial } from "@/data/antimicrobial.types";
import type { Module, Topic } from "@/lib/content-types";
import { getCalculators, getModules, getNews, getSections } from "@/lib/content";
import { ANTIMICROBIALS } from "@/lib/antimicrobials";
import { SITE } from "@/lib/site";
import { GUIDES, type Faq, type Guide } from "@/lib/learn";
import type { Calculator } from "@/lib/content-types";

export const SITE_ORIGIN = SITE.url.replace(/\/$/, "");
export const TITLE_TEMPLATE = `%s — ${SITE.name}`;
export const DEFAULT_TITLE = `${SITE.name} — ${SITE.tagline}`;
/** Home <title>: brand + the intents people search for ("ICU learning", "ventilator simulator", "ECG"). */
export const HOME_TITLE = `${SITE.name}: free ICU learning app with ventilator and ECG simulators`;
export const HOME_DESCRIPTION = "ICU 360 (icu360.in) by critical care consultant Dr. Kenil Shah: a free ICU learning app for interns and junior doctors. Bedside ICU guides, ICU calculators, an ABG interpreter, and interactive ventilator and ECG simulators.";
/** Other names people use for the site; "ICU 360" alone collides with an infusion pump brand. */
export const ALT_NAMES = ["ICU360", "icu360.in", "ICU 360 by Dr. Kenil Shah"];

export const AUTHOR = {
  name: "Dr. Kenil Shah",
  jobTitle: "Critical care consultant",
} as const;

/** Google Search Console HTML-tag verification. Leave unset until Kenil pastes the token. */
export function googleVerification(): Metadata["verification"] {
  const token = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  return token ? { google: token } : undefined;
}

export function pageMeta(opts: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  follow?: boolean;
}): Metadata {
  const { title, description, path, index = true, follow = true } = opts;
  const url = path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
  const fullTitle = title === SITE.name || title.includes(SITE.name) ? title : `${title} — ${SITE.name}`;
  return {
    title,
    description,
    alternates: { canonical: path, languages: { "en-IN": path, "x-default": path } },
    robots: { index, follow },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE.name,
      locale: "en_IN",
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: DEFAULT_TITLE }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function personJsonLd() {
  return {
    "@type": "Person",
    "@id": `${SITE_ORIGIN}/#kenil-shah`,
    name: AUTHOR.name,
    jobTitle: AUTHOR.jobTitle,
    description: `${AUTHOR.jobTitle} and creator of ${SITE.name}, a free ICU reference for junior doctors.`,
    url: SITE_ORIGIN,
  };
}

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: SITE.name,
    alternateName: ALT_NAMES,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/brand/logo-dark-512.png`,
    description: SITE.description,
    founder: { "@id": `${SITE_ORIGIN}/#kenil-shah` },
  };
}

export function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: SITE.name,
    alternateName: ALT_NAMES,
    url: SITE_ORIGIN,
    description: SITE.description,
    inLanguage: "en-IN",
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_ORIGIN}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function homeJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [personJsonLd(), organizationJsonLd(), websiteJsonLd()],
  };
}

export function faqJsonLd(faqs: Faq[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE_ORIGIN}${it.path === "/" ? "/" : it.path}` })),
  };
}

/** Interactive educational simulator (ECG OS, Ventilator OS). */
export function simulatorJsonLd(o: { name: string; description: string; path: string; faqs?: Faq[]; teaches?: string[] }) {
  const url = `${SITE_ORIGIN}${o.path}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": ["SoftwareApplication", "LearningResource"],
      name: o.name,
      description: o.description,
      url,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Any (web browser)",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      isAccessibleForFree: true,
      inLanguage: "en-IN",
      learningResourceType: "Simulation",
      educationalLevel: "Intern, resident, ICU nurse",
      ...(o.teaches?.length ? { teaches: o.teaches } : {}),
      audience: { "@type": "MedicalAudience", audienceType: "Clinician" },
      author: { "@id": `${SITE_ORIGIN}/#kenil-shah` },
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    },
    breadcrumbJsonLd([{ name: SITE.name, path: "/" }, { name: "Tools", path: "/tools" }, { name: o.name, path: o.path }]),
  ];
  if (o.faqs?.length) graph.push(faqJsonLd(o.faqs));
  return { "@context": "https://schema.org", "@graph": graph };
}

/** /learn/* guides: an article-style learning resource with FAQs. */
export function guideJsonLd(g: Guide) {
  const url = `${SITE_ORIGIN}${g.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["MedicalWebPage", "LearningResource"],
        name: g.h1,
        headline: g.metaTitle,
        description: g.description,
        url,
        inLanguage: "en-IN",
        isAccessibleForFree: true,
        learningResourceType: "Guide",
        educationalLevel: "Intern, resident, ICU nurse",
        teaches: g.teaches,
        audience: { "@type": "MedicalAudience", audienceType: "Clinician" },
        specialty: "https://schema.org/CriticalCare",
        author: { "@id": `${SITE_ORIGIN}/#kenil-shah` },
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
      },
      breadcrumbJsonLd([{ name: SITE.name, path: "/" }, { name: "Learn", path: "/learn" }, { name: g.h1, path: g.path }]),
      faqJsonLd(g.faqs),
    ],
  };
}

/** <title> for a calculator page, phrased the way people search ("P/F ratio calculator"). */
const CALC_TITLES: Record<string, string> = {
  "infusion-rate-weight-min": "Infusion rate calculator (mcg/kg/min to mL/h)",
  "predicted-body-weight": "Predicted (ideal) body weight calculator",
  "tidal-volume-pbw": "Tidal volume calculator (mL/kg predicted body weight)",
  "pf-ratio": "P/F ratio calculator (PaO₂/FiO₂)",
  "sf-ratio": "S/F ratio calculator (SpO₂/FiO₂)",
  "driving-pressure": "Driving pressure calculator (plateau − PEEP)",
  "static-compliance": "Static compliance calculator (ventilator)",
  "rox-index": "ROX index calculator (HFNC)",
  rsbi: "RSBI calculator (rapid shallow breathing index)",
  "aa-gradient": "A–a gradient calculator",
  "anion-gap": "Anion gap calculator",
  "anion-gap-albumin-corrected": "Corrected anion gap calculator (albumin)",
  "winters-formula": "Winter's formula calculator (expected PaCO₂)",
  "delta-ratio": "Delta ratio calculator",
  "corrected-sodium-glucose": "Corrected sodium calculator (glucose)",
  "creatinine-clearance-cg": "Creatinine clearance calculator (Cockcroft-Gault)",
  fena: "FENa calculator (fractional excretion of sodium)",
  "mean-arterial-pressure": "MAP calculator (mean arterial pressure)",
  "qtc-bazett": "QTc calculator (Bazett)",
  gcs: "GCS calculator (Glasgow Coma Scale)",
  qsofa: "qSOFA score calculator",
  sofa: "SOFA score calculator",
  news2: "NEWS2 score calculator",
  "curb-65": "CURB-65 score calculator",
  "wells-pe": "Wells score for PE calculator",
  rass: "RASS (Richmond Agitation-Sedation Scale)",
  "pop-scale": "POP scale calculator (organophosphorus poisoning)",
};

export function calcSeoTitle(c: Pick<Calculator, "id" | "name">): string {
  if (CALC_TITLES[c.id]) return CALC_TITLES[c.id];
  return /calculator|score|scale|index/i.test(c.name) ? c.name : `${c.name} calculator`;
}

export function calcSeoDescription(c: Pick<Calculator, "name" | "description">): string {
  const d = c.description.trim().replace(/\.?$/, ".");
  return `${d} Free online ICU calculator on ${SITE.name}, for interns and junior doctors.`;
}

export function topicJsonLd(module: Module, topic: Topic) {
  const url = `${SITE_ORIGIN}/m/${module.id}/${topic.id}`;
  const page: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: topic.title,
    headline: topic.title,
    description: topic.summary,
    url,
    inLanguage: "en-IN",
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    author: { "@id": `${SITE_ORIGIN}/#kenil-shah` },
    about: {
      "@type": "MedicalCondition",
      name: topic.title,
    },
    audience: { "@type": "MedicalAudience", audienceType: "Clinician" },
    specialty: "https://schema.org/CriticalCare",
  };
  if (module.lastReviewed) {
    page.dateModified = module.lastReviewed;
    page.lastReviewed = module.lastReviewed;
    if (module.reviewStatus === "consultant-reviewed" || module.reviewStatus === "published") {
      page.reviewedBy = { "@id": `${SITE_ORIGIN}/#kenil-shah` };
    }
  }
  return page;
}

export function drugJsonLd(a: Antimicrobial) {
  const url = `${SITE_ORIGIN}/antimicrobials/${a.id}`;
  const drug: Record<string, unknown> = {
    "@type": "Drug",
    name: a.name,
    nonProprietaryName: a.name,
    url,
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
  };
  if (a.drugClass) drug.drugClass = a.drugClass;
  if (a.indications.length) {
    drug.indication = a.indications.map((name) => ({ "@type": "MedicalIndication", name }));
  }
  if (a.contraindications.length) drug.contraindication = a.contraindications;
  if (a.cautions.length) drug.warning = a.cautions;
  if (a.route.length) drug.administrationRoute = a.route;
  if (a.brandsIndia.length) drug.proprietaryName = a.brandsIndia;
  if (a.spectrum) drug.description = a.spectrum;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MedicalWebPage",
        name: a.name,
        description: `${a.name} (${a.drugClass}): indications, adult and ICU dose, contraindications and Indian brands.`,
        url,
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        audience: { "@type": "MedicalAudience", audienceType: "Clinician" },
        mainEntity: drug,
      },
    ],
  };
}

export type SitemapEntry = MetadataRoute.Sitemap[number];

/** Public, indexable routes. Excludes /stats, /offline, /saved, /progress and /search. */
export function getSitemapEntries(): SitemapEntry[] {
  const lastNews = getNews()[0]?.date;
  const newsDate = lastNews ? new Date(`${lastNews}T00:00:00+05:30`) : undefined;
  const entries: SitemapEntry[] = [
    { url: `${SITE_ORIGIN}/`, lastModified: newsDate, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_ORIGIN}/browse`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_ORIGIN}/news`, lastModified: newsDate, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_ORIGIN}/quiz`, lastModified: newsDate, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_ORIGIN}/tools`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_ORIGIN}/tools/abg`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_ORIGIN}/tools/ecg-os`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_ORIGIN}/tools/ventilator-os`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_ORIGIN}/learn`, changeFrequency: "monthly", priority: 0.9 },
    ...GUIDES.map((g): SitemapEntry => ({ url: `${SITE_ORIGIN}${g.path}`, changeFrequency: "monthly", priority: 0.9 })),
    { url: `${SITE_ORIGIN}/tools/code-timer`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_ORIGIN}/antimicrobials`, changeFrequency: "weekly", priority: 0.8 },
  ];

  for (const c of getCalculators()) {
    entries.push({
      url: `${SITE_ORIGIN}/tools/${c.id}`,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  }

  for (const s of getSections()) {
    entries.push({
      url: `${SITE_ORIGIN}/section/${s.slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  for (const a of ANTIMICROBIALS) {
    entries.push({
      url: `${SITE_ORIGIN}/antimicrobials/${a.id}`,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const m of getModules()) {
    const modified = m.lastReviewed ? new Date(`${m.lastReviewed}T00:00:00+05:30`) : undefined;
    entries.push({
      url: `${SITE_ORIGIN}/m/${m.id}`,
      lastModified: modified,
      changeFrequency: "monthly",
      priority: 0.6,
    });
    for (const t of m.topics) {
      entries.push({
        url: `${SITE_ORIGIN}/m/${m.id}/${t.id}`,
        lastModified: modified,
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  }

  return entries;
}
