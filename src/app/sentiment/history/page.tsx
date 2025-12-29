'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import MegaMenu from '@/components/layout/MegaMenu';
import SentimentHistory from '@/components/dashboard/SentimentHistory';

interface Instrument {
  symbol: string;
}

export default function SentimentHistoryPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);

  // Get symbol from URL params (e.g., /sentiment/history?symbol=EUR/USD)
  const initialSymbol = searchParams.get('symbol') || undefined;

  useEffect(() => {
    const fetchInstruments = async () => {
      try {
        const response = await fetch('/api/sentiment');
        const json = await response.json();
        setInstruments((json.data || []).map((d: { symbol: string }) => ({ symbol: d.symbol })));
      } catch (error) {
        console.error('Failed to fetch instruments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInstruments();
  }, []);

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-background-primary">
      <MegaMenu
        userEmail={session?.user?.email || ''}
        isAdmin={isAdmin}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Sentiment History</h1>
          <p className="text-text-secondary text-sm mt-1">
            Historical sentiment charts for each instrument
          </p>
        </div>

        <SentimentHistory instruments={instruments} loading={loading} initialSymbol={initialSymbol} />
      </main>
    </div>
  );
}
