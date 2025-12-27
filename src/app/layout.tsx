import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Daghandelaren - Forex Sentiment Dashboard',
  description: 'Real-time forex sentiment data from multiple sources',
  keywords: ['forex', 'sentiment', 'trading', 'dashboard', 'analysis'],
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background-primary text-text-primary min-h-screen`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
