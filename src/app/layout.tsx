import type { Metadata } from 'next';
import { Cinzel_Decorative, IM_Fell_English_SC, Crimson_Text, Geist_Mono } from 'next/font/google';
import './globals.css';

const cinzelDecorative = Cinzel_Decorative({
  variable: '--font-logo',
  subsets: ['latin'],
  weight: '700',
});

const imFellEnglishSC = IM_Fell_English_SC({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: '400',
});

const crimsonText = Crimson_Text({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Sideboard — Campaign Manager',
  description: 'TTRPG DM campaign management tool',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${cinzelDecorative.variable} ${imFellEnglishSC.variable} ${crimsonText.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
