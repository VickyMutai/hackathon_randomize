import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://ciris-team-builder.royal-plume-4094.chatgpt.site'),
  title: 'CIRIS Hackathon Team Builder',
  description: 'Create balanced, institution-diverse teams for the CIRIS Agriculture & Climate Action Hackathon.',
  openGraph: {
    title: 'CIRIS Team Builder',
    description: 'Balanced, institution-diverse teams for the Agriculture & Climate Action Hackathon.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CIRIS Team Builder',
    description: 'Balanced, institution-diverse teams for the Agriculture & Climate Action Hackathon.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
