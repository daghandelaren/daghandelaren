'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import MegaMenu from '@/components/layout/MegaMenu';
import PairBiasTable from '@/components/fundamental/PairBiasTable';

interface PairBias {
  pair: string;
  base: string;
  quote: string;
  score: number;
  rating: 'Bullish' | 'Neutral' | 'Bearish';
}

export default function PairBiasesPage() {
  const { data: session } = useSession();
  const [pairBiases, setPairBiases] = useState<PairBias[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/fundamental');
        const data = await res.json();
        setPairBiases(data.pairBiases || []);
      } catch (error) {
        console.error('Failed to fetch pair biases:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-background-primary">
      <MegaMenu userEmail={session?.user?.email || ''} isAdmin={isAdmin} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-primary">Pair Biases</h1>
          <p className="text-text-secondary text-sm mt-1">
            Directional bias for currency pairs based on fundamental analysis
          </p>
        </div>

        {loading ? (
          <div className="card p-6 animate-pulse">
            <div className="h-8 bg-surface-secondary rounded w-48 mb-4" />
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-10 bg-surface-secondary rounded" />
              ))}
            </div>
          </div>
        ) : (
          <PairBiasTable pairs={pairBiases} />
        )}

        {!loading && pairBiases.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-text-muted">No pair bias data yet. Run fundamental analysis from the Admin panel.</p>
          </div>
        )}
      </main>
    </div>
  );
}
