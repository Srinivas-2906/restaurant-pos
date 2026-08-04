import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kaana — Order at Table" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui", background: "#f9fafb" }}>{children}</body>
    </html>
  );
}
