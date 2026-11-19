import { safeJsonLd } from "@/lib/seo";

/** Server-rendered JSON-LD. Content is escaped so a "</script>" in a string cannot break out. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }} />
  );
}
