import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist',
});

export const metadata: Metadata = {
  title: 'ODAVL Guardian - Silent Failure Detection for Modern Web Apps',
  description: 'Find interactions that look clickable but produce no real effect. Signal, not truth.',
  keywords: ['testing', 'QA', 'silent failures', 'user interactions', 'web testing'],
  authors: [{ name: 'ODAVL' }],
  openGraph: {
    title: 'ODAVL Guardian',
    description: 'Silent Failure Detection for Modern Web Apps',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
