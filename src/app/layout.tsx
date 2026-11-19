import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Aurora, Sidebar, TopBar } from "@/components/Shell";
import { TabBar } from "@/components/client/Nav";
import { PwaSetup } from "@/components/client/Pwa";
import { EdgeSwipeBack } from "@/components/client/EdgeSwipeBack";
import { SITE } from "@/lib/site";
import { AUTHOR, DEFAULT_TITLE, TITLE_TEMPLATE, googleVerification } from "@/lib/seo";
import { Footer } from "@/components/Footer";
import { StartupSplash } from "@/components/StartupSplash";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-inter-tight", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: DEFAULT_TITLE, template: TITLE_TEMPLATE },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: AUTHOR.name, url: SITE.url }],
  creator: AUTHOR.name,
  publisher: SITE.name,
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-light-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icons/favicon-dark-32.png", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
      { url: "/icons/favicon-light-48.png", sizes: "48x48", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icons/favicon-dark-48.png", sizes: "48x48", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description: SITE.description,
    siteName: SITE.name,
    url: SITE.url,
    locale: "en_IN",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: DEFAULT_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: SITE.description,
    images: ["/opengraph-image"],
  },
  verification: googleVerification(),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EAF0F5" },
    { media: "(prefers-color-scheme: dark)", color: "#05080F" },
  ],
};

// Runs before paint: theme (no flash) and whether to skip the first-load startup mark.
// A persistent <style> is used for the skip so a later React hydration cannot uncover the overlay.
const themeScript = `(function(){try{var p=localStorage.getItem('icu360:theme');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}try{var skip=window.matchMedia('(prefers-reduced-motion: reduce)').matches||!!sessionStorage.getItem('icu360:splash');if(skip){document.documentElement.classList.add('splash-skip');var s=document.createElement('style');s.id='startup-splash-skip';s.textContent='.startup-splash{display:none!important}';document.documentElement.appendChild(s);}else{sessionStorage.setItem('icu360:splash','1');}}catch(e){document.documentElement.classList.add('splash-skip');}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`font-sans min-h-screen ${inter.variable} ${interTight.variable} ${mono.variable}`}>
        <StartupSplash />
        <Aurora />
        <div className="app lg:flex">
          <Sidebar />
          <div className="flex-1 min-w-0">
            <TopBar />
            <div className="mx-auto w-full max-w-[720px] lg:max-w-none lg:pr-6">
              {children}
              <div className="px-4 lg:px-1 pb-36 lg:pb-10">
                <Footer />
              </div>
            </div>
          </div>
        </div>
        <TabBar />
        <EdgeSwipeBack />
        <PwaSetup />
      </body>
    </html>
  );
}
