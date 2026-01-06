import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'verax verax - Silent Failure Detection for Modern Web Apps',
  description: 'Find interactions that look clickable but produce no real effect. Signal, not truth.',
  keywords: ['testing', 'QA', 'silent failures', 'user interactions', 'web testing'],
  authors: [{ name: 'verax' }],
  openGraph: {
    title: 'verax verax',
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
    <html lang="en">
      <body className={`min-h-screen ${inter.className}`}>{children}</body>
    </html>
  );
}
