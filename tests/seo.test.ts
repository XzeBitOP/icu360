import { describe, expect, it } from "vitest";
import { getAntimicrobial } from "../src/lib/antimicrobials";
import { getTopic } from "../src/lib/content";
import {
  AUTHOR,
  SITE_ORIGIN,
  drugJsonLd,
  getSitemapEntries,
  homeJsonLd,
  pageMeta,
  safeJsonLd,
  topicJsonLd,
} from "../src/lib/seo";
import robots from "../src/app/robots";

describe("pageMeta", () => {
  it("sets a unique title, description, canonical URL and social cards", () => {
    const m = pageMeta({
      title: "Septic shock",
      description: "Hour-1 bundle and initial resuscitation.",
      path: "/m/sepsis-septic-shock/hour-1-bundle",
    });
    expect(m.title).toBe("Septic shock");
    expect(m.description).toMatch(/Hour-1/);
    expect(m.alternates?.canonical).toBe("/m/sepsis-septic-shock/hour-1-bundle");
    expect(m.openGraph?.title).toBe("Septic shock — ICU 360");
    expect(m.openGraph?.url).toBe(`${SITE_ORIGIN}/m/sepsis-septic-shock/hour-1-bundle`);
    expect(m.twitter).toMatchObject({ card: "summary_large_image", title: "Septic shock — ICU 360" });
    expect(m.openGraph?.images).toEqual([{ url: "/opengraph-image", width: 1200, height: 630, alt: "ICU 360 — Critical care, at the bedside" }]);
  });

  it("marks private pages as noindex", () => {
    const m = pageMeta({ title: "Stats", description: "Private", path: "/stats", index: false, follow: false });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
});

describe("sitemap", () => {
  const entries = getSitemapEntries();
  const urls = entries.map((e) => e.url);

  it("covers home, browse, news, tools, antimicrobials, every topic and every drug", () => {
    for (const path of [
      "/",
      "/browse",
      "/news",
      "/quiz",
      "/tools",
      "/tools/abg",
      "/tools/ventilator",
      "/tools/code-timer",
      "/antimicrobials",
      "/antimicrobials/meropenem",
      "/m/sepsis-septic-shock",
      "/m/sepsis-septic-shock/hour-1-bundle",
      "/section/a",
    ]) {
      expect(urls).toContain(`${SITE_ORIGIN}${path === "/" ? "/" : path}`.replace(/^(https:\/\/icu360\.in)\/$/, "$1/"));
      expect(urls).toContain(path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`);
    }
    expect(urls.filter((u) => u.includes("/antimicrobials/")).length).toBe(211);
    expect(urls.filter((u) => /^https:\/\/icu360\.in\/m\/[^/]+\/[^/]+$/.test(u) || /^https:\/\/icu360\.in\/m\/.+\/.+$/.test(u)).length).toBeGreaterThan(200);
  });

  it("has unique URLs and never lists private routes", () => {
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.some((u) => u.includes("/stats"))).toBe(false);
    expect(urls.some((u) => u.includes("/offline"))).toBe(false);
    expect(urls.some((u) => u.includes("/saved"))).toBe(false);
    expect(urls.some((u) => u.includes("/progress"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/search") || u.includes("/search?"))).toBe(false);
  });
});

describe("robots", () => {
  it("allows the site, points at the sitemap, and blocks /stats", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    const disallow = rules.flatMap((x) => (Array.isArray(x?.disallow) ? x!.disallow : x?.disallow ? [x.disallow] : []));
    expect(disallow.join(" ")).toMatch(/\/stats/);
    expect(r.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
  });
});

describe("JSON-LD", () => {
  it("escapes angle brackets so a payload cannot break out of the script tag", () => {
    const raw = safeJsonLd({ name: "</script><script>alert(1)" });
    expect(raw).not.toContain("</script>");
    expect(JSON.parse(raw.replace(/\\u003c/g, "<"))).toEqual({ name: "</script><script>alert(1)" });
  });

  it("emits a well-formed WebSite graph with SearchAction on the home page", () => {
    const data = homeJsonLd();
    const parsed = JSON.parse(safeJsonLd(data));
    expect(parsed["@context"]).toBe("https://schema.org");
    const types = parsed["@graph"].map((n: { "@type": string }) => n["@type"]);
    expect(types).toEqual(expect.arrayContaining(["WebSite", "Organization", "Person"]));
    const site = parsed["@graph"].find((n: { "@type": string }) => n["@type"] === "WebSite");
    expect(site.potentialAction["@type"]).toBe("SearchAction");
    expect(site.potentialAction.target.urlTemplate).toBe(`${SITE_ORIGIN}/search?q={search_term_string}`);
    const person = parsed["@graph"].find((n: { "@type": string }) => n["@type"] === "Person");
    expect(person.name).toBe(AUTHOR.name);
    expect(person.jobTitle).toBe(AUTHOR.jobTitle);
  });

  it("emits MedicalWebPage for a topic and Drug for an antimicrobial", () => {
    const r = getTopic("sepsis-septic-shock", "hour-1-bundle");
    expect(r).toBeDefined();
    const topic = JSON.parse(safeJsonLd(topicJsonLd(r!.module, r!.topic)));
    expect(topic["@type"]).toBe("MedicalWebPage");
    expect(topic.name).toMatch(/Hour-1/i);
    expect(topic.url).toBe(`${SITE_ORIGIN}/m/sepsis-septic-shock/hour-1-bundle`);

    const mero = getAntimicrobial("meropenem");
    expect(mero).toBeDefined();
    const drugPage = JSON.parse(safeJsonLd(drugJsonLd(mero!)));
    const types = [drugPage["@type"], ...(drugPage["@graph"] ?? []).map((n: { "@type": string }) => n["@type"])];
    expect(types).toContain("MedicalWebPage");
    const drug = (drugPage["@graph"] ?? [drugPage]).flatMap((n: { mainEntity?: unknown }) => n.mainEntity ?? []).find((x: { "@type"?: string }) => x && x["@type"] === "Drug");
    expect(drug.name).toBe("Meropenem");
    expect(drug.drugClass).toBeTruthy();
  });
});
