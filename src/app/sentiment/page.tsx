'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import MegaMenu from '@/components/layout/MegaMenu';
import FilterBar from '@/components/dashboard/FilterBar';
import SentimentTable from '@/components/dashboard/SentimentTable';

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

interface SentimentResponse {
  data: SentimentItem[];
  meta: {
    total: number;
    sources: string[];
    lastUpdated: string;
  };
}

export default function SentimentTablePage() {
  const { data: session } = useSession();
  const [data, setData] = useState<SentimentItem[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [assetClass, setAssetClass] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (source) params.set('source', source);
      if (assetClass) params.set('assetClass', assetClass);

      const response = await fetch(`/api/sentiment?${params.toString()}`);
      const json: SentimentResponse = await response.json();

      setData(json.data);
      setSources(json.meta.sources);
    } catch (error) {
      console.error('Failed to fetch sentiment data:', error);
    } finally {
      setLoading(false);
    }
  }, [search, source, assetClass]);

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
          <h1 className="text-2xl font-bold text-text-primary">Sentiment Table</h1>
          <p className="text-text-secondary text-sm mt-1">
            Full sentiment data across all instruments
          </p>
        </div>

        <div className="mb-6">
          <FilterBar
            onSearchChange={setSearch}
            onSourceChange={setSource}
            onAssetClassChange={setAssetClass}
            sources={sources}
          />
        </div>

        <SentimentTable data={data || []} loading={loading} />

        <div className="mt-8 pt-6 border-t border-border-primary/50 text-center">
          <p className="text-text-muted text-xs">
            Data sources: {sources.length > 0 ? sources.join(' · ') : 'None available'}
          </p>
        </div>
      </main>
    </div>
  );
}
