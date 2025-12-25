import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "ODAVL Guardian — Real Browser Flow Checks",
  description:
    "Runs real browser flows locally or in CI, detects breakage (navigation, submission, visual issues, timeouts), and produces human‑readable HTML reports.",
  icons: {
    icon: "/favicon.svg"
  },
  openGraph: {
    type: "website",
    title: "ODAVL Guardian — Real Browser Flow Checks",
    description: "Runs real browser flows locally or in CI, detects breakage, and produces human‑readable HTML reports.",
    siteName: "ODAVL Guardian",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ODAVL Guardian"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "ODAVL Guardian — Real Browser Flow Checks",
    description: "Runs real browser flows locally or in CI, detects breakage, and produces human‑readable HTML reports.",
    images: ["/og-image.png"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} grain`}>
        {children}
      </body>
    </html>
  );
}
