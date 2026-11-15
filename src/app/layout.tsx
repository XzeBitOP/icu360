import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Aurora, Sidebar, TopBar } from "@/components/Shell";
import { TabBar } from "@/components/client/Nav";
import { PwaSetup } from "@/components/client/Pwa";
import { EdgeSwipeBack } from "@/components/client/EdgeSwipeBack";
import { SITE } from "@/lib/site";
import { Footer } from "@/components/Footer";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-inter-tight", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} · ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
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
  openGraph: { title: SITE.name, description: SITE.description, siteName: SITE.name, images: [{ url: "/brand/logo-dark-512.png", width: 512, height: 512 }], type: "website" },
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

// Runs before paint: pick dark/light from the saved choice or the device setting, so there is no flash.
const themeScript = `(function(){try{var p=localStorage.getItem('icu360:theme');var d=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${interTight.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans min-h-screen">
        <div className="splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-light-256.png" alt="" width={128} height={128} className="block dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-dark-256.png" alt="" width={128} height={128} className="hidden dark:block" />
        </div>
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
