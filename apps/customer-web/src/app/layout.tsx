import type { Metadata, Viewport } from "next";
import "@kaana/ui/base.css";


export const metadata: Metadata = {

  title: "Kaana Kitchens — Order at Table",

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

      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f9fafb", overflowX: "clip", minHeight: "100dvh" }}>

        {children}

      </body>

    </html>

  );

}

