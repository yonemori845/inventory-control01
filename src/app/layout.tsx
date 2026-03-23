import { SentryClientInit } from "@/components/monitoring/SentryClientInit";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "在庫管理システム",
  description: "Inventory control（課題用・架空データ）",
  appleWebApp: {
    capable: true,
    title: "在庫管理",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased min-h-screen">
        <SentryClientInit />
        <ServiceWorkerRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
