import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import { LOGO_BASE64 } from '@/constants/logo';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Daghandelaren - Trading Dashboard',
  description: 'Real-time forex sentiment data from multiple sources',
  keywords: ['forex', 'sentiment', 'trading', 'dashboard', 'analysis'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href={LOGO_BASE64} />
        <link rel="apple-touch-icon" href={LOGO_BASE64} />
      </head>
      <body className={`${inter.className} bg-background-primary text-text-primary min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
