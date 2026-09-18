import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@kaana/ui/base.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kaana Kitchens HQ",
  description: "Kaana Kitchens platform administration",
  icons: { icon: "/kaana-logo.png", apple: "/kaana-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
