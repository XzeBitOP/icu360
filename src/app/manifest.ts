import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A111C",
    theme_color: "#0A111C",
    categories: ["medical", "education", "health"],
    lang: "en-IN",
    // One home-screen icon only (Android/iOS cannot switch it with the theme): the dark logo stands out on any wallpaper.
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Search", url: "/search" },
      { name: "Infusion calculator", url: "/tools/infusion-rate-weight-min" },
      { name: "ABG interpreter", url: "/tools/abg" },
      { name: "Daily quiz", url: "/quiz" },
    ],
  };
}
