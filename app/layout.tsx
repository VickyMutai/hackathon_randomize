import type { Metadata } from 'next';
import { Lexend } from 'next/font/google';
import './globals.css';

const lexend = Lexend({
  variable: '--font-lexend',
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
      <body className={`${lexend.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
