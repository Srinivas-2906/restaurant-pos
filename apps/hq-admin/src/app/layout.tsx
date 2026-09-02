import type { Metadata, Viewport } from "next";
import "@kaana/ui/base.css";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
