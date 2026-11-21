import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { getCalculators, getCalculator, getModules } from "../src/lib/content";
import { GUIDES, practiceLinks } from "../src/lib/learn";
import { HOME_TITLE, calcSeoDescription, calcSeoTitle, getSitemapEntries, guideJsonLd, homeJsonLd, pageMeta, safeJsonLd, simulatorJsonLd, SITE_ORIGIN } from "../src/lib/seo";

const urls = getSitemapEntries().map((e) => e.url);
const topicHrefs = new Set(getModules().flatMap((m) => [`/m/${m.id}`, ...m.topics.map((t) => `/m/${m.id}/${t.id}`)]));
const calcHrefs = new Set(getCalculators().map((c) => `/tools/${c.id}`));
const staticHrefs = new Set(["/learn", "/tools", "/tools/abg", "/tools/ecg-os", "/tools/ventilator-os", "/tools/code-timer", "/browse", "/quiz", "/news", "/antimicrobials", ...GUIDES.map((g) => g.path)]);
const known = (href: string) => topicHrefs.has(href) || calcHrefs.has(href) || staticHrefs.has(href);

describe("learn guides", () => {
  it("are in the sitemap with high priority", () => {
    for (const p of ["/learn", "/learn/ventilator", "/learn/ecg", "/learn/abg"]) expect(urls).toContain(`${SITE_ORIGIN}${p}`);
    const e = getSitemapEntries().find((x) => x.url === `${SITE_ORIGIN}/learn/ventilator`);
    expect(e?.priority).toBeGreaterThanOrEqual(0.9);
  });

  it("only link to pages that exist", () => {
    for (const g of GUIDES) {
      for (const l of [...g.links, ...(g.cta ? [g.cta] : [])]) expect(known(l.href), `${g.slug} -> ${l.href}`).toBe(true);
      for (const s of g.sections) for (const m of s.body.matchAll(/\]\((\/[^)]+)\)/g)) expect(known(m[1]), m[1]).toBe(true);
    }
    for (const m of getModules()) for (const l of practiceLinks(m.id)) expect(known(l.href), l.href).toBe(true);
    expect(existsSync("src/app/learn/[slug]/page.tsx")).toBe(true);
  });

  it("have unique, reasonably sized titles and descriptions", () => {
    const titles = GUIDES.map((g) => g.metaTitle);
    expect(new Set(titles).size).toBe(titles.length);
    for (const g of GUIDES) {
      expect(g.metaTitle.length).toBeLessThanOrEqual(70);
      expect(g.description.length).toBeGreaterThan(80);
      expect(g.description.length).toBeLessThanOrEqual(260);
      expect(g.faqs.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("emit LearningResource, BreadcrumbList and FAQPage JSON-LD", () => {
    const d = JSON.parse(safeJsonLd(guideJsonLd(GUIDES[0])));
    const types = d["@graph"].flatMap((n: { "@type": string | string[] }) => n["@type"]);
    expect(types).toEqual(expect.arrayContaining(["LearningResource", "BreadcrumbList", "FAQPage"]));
    const faq = d["@graph"].find((n: { "@type": string }) => n["@type"] === "FAQPage");
    expect(faq.mainEntity[0].acceptedAnswer.text.length).toBeGreaterThan(20);
  });
});

describe("simulator and home SEO", () => {
  it("simulator JSON-LD is a free SoftwareApplication with FAQs", () => {
    const d = JSON.parse(safeJsonLd(simulatorJsonLd({ name: "Ventilator OS", description: "x", path: "/tools/ventilator-os", faqs: [{ q: "Q?", a: "A." }] })));
    const app = d["@graph"][0];
    expect(app["@type"]).toContain("SoftwareApplication");
    expect(app.offers.price).toBe("0");
    expect(d["@graph"].some((n: { "@type": string }) => n["@type"] === "FAQPage")).toBe(true);
  });

  it("home title names the intent and the site has disambiguating alternate names", () => {
    expect(HOME_TITLE).toMatch(/ICU 360/);
    expect(HOME_TITLE).toMatch(/ventilator/i);
    expect(HOME_TITLE).toMatch(/ECG/);
    const g = homeJsonLd()["@graph"] as { "@type": string; alternateName?: string[] }[];
    expect(g.find((n) => n["@type"] === "WebSite")?.alternateName).toContain("icu360.in");
  });

  it("adds en-IN hreflang alongside the canonical", () => {
    const m = pageMeta({ title: "T", description: "D", path: "/learn" });
    expect(m.alternates?.languages).toEqual({ "en-IN": "/learn", "x-default": "/learn" });
  });

  it("calculator titles read like searches and stay unique", () => {
    expect(calcSeoTitle(getCalculator("pf-ratio")!)).toMatch(/^P\/F ratio calculator/);
    expect(calcSeoTitle(getCalculator("sofa")!)).toBe("SOFA score calculator");
    const all = getCalculators().map((c) => calcSeoTitle(c));
    expect(new Set(all).size).toBe(all.length);
    for (const c of getCalculators()) expect(calcSeoDescription(c)).toMatch(/\.\s.*ICU 360/);
  });
});
