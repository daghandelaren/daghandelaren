'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import MegaMenu from '@/components/layout/MegaMenu';
import OverviewCards from '@/components/dashboard/OverviewCards';
import SentimentOverview from '@/components/dashboard/SentimentOverview';

interface SentimentItem {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  assetClass: string;
  longPercent: number;
  shortPercent: number;
  netSentiment: number;
  blendedLong: number;
  blendedShort: number;
  blendedNet: number;
  sourcesUsed: string[];
  sources: {
    name: string;
    longPercent: number;
    shortPercent: number;
    netSentiment: number;
    timestamp: string;
  }[];
  lastUpdated: string;
}

import type { NewOverviewData } from '@/types';

interface SentimentResponse {
  data: SentimentItem[];
  newOverview?: NewOverviewData;
  meta: {
    total: number;
    sources: string[];
    lastUpdated: string;
  };
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<SentimentItem[]>([]);
  const [newOverview, setNewOverview] = useState<NewOverviewData | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('newOverview', 'true');

      const response = await fetch(`/api/sentiment?${params.toString()}`);
      const json: SentimentResponse = await response.json();

      setData(json.data);
      setNewOverview(json.newOverview ?? null);
      setSources(json.meta.sources);
    } catch (error) {
      console.error('Failed to fetch sentiment data:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSearch = (query: string) => {
    setSearch(query);
  };

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-background-primary">
      <MegaMenu
        userEmail={session?.user?.email || ''}
        isAdmin={isAdmin}
        onSearch={handleSearch}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <OverviewCards
            data={newOverview}
            loading={loading}
          />
        </div>

        <SentimentOverview
          data={(data || []).map((item) => ({
            ...item,
            blendedLong: item.blendedLong,
            blendedShort: item.blendedShort,
          }))}
          loading={loading}
        />

        <div className="mt-8 pt-6 border-t border-border-primary/50 text-center">
          <p className="text-text-muted text-xs">
            Data sources: {sources.length > 0 ? sources.join(' · ') : 'None available'}
          </p>
          <p className="text-text-muted/70 text-xs mt-1">
            Weights: Myfxbook (2) · OANDA (2) · Dukascopy (1) · ForexFactory (1) · FXBlue (1)
          </p>
        </div>
      </main>
    </div>
  );
}
