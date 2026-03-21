import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mutagenix",
  description:
    "Evolvi. Muta. Domina. La tua creatura parte come un blob informe — ogni giorno decidi tu cosa diventerà.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mutagenix",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  icons: [
    { rel: "icon", url: "/icon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/icon-192.png" },
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0b0f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
