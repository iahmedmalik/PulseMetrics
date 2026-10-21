import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Hanken_Grotesk, Red_Hat_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-barlow-condensed" });
const text = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken-grotesk" });
const mono = Red_Hat_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-red-hat-mono" });

export const metadata: Metadata = {
  title: { default: "PulseMetrics", template: "%s · PulseMetrics" },
  description: "Product analytics for small apps. Funnels, daily active browsers and A/B tests, with no cookies and no personal data.",
};

export const viewport: Viewport = { themeColor: "#03100b" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
