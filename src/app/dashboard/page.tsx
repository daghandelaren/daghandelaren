'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardHeader from '@/components/layout/DashboardHeader';
import OverviewCards from '@/components/dashboard/OverviewCards';
import FilterBar from '@/components/dashboard/FilterBar';
import SentimentTable from '@/components/dashboard/SentimentTable';
import SentimentHistory from '@/components/dashboard/SentimentHistory';
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

type ViewType = 'overview' | 'table' | 'history';

export default function DashboardPage() {
  const [data, setData] = useState<SentimentItem[]>([]);
  const [newOverview, setNewOverview] = useState<NewOverviewData | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [assetClass, setAssetClass] = useState('');
  const [view, setView] = useState<ViewType>('overview');

  // Fetch sentiment data
  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (source) params.set('source', source);
      if (assetClass) params.set('assetClass', assetClass);
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
  }, [search, source, assetClass]);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();

    // Poll every hour
    const interval = setInterval(fetchData, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle search from header
  const handleHeaderSearch = (query: string) => {
    setSearch(query);
  };

  // Render the current view
  const renderView = () => {
    switch (view) {
      case 'overview':
        return (
          <SentimentOverview
            data={data.map((item) => ({
              ...item,
              blendedLong: item.blendedLong,
              blendedShort: item.blendedShort,
            }))}
            loading={loading}
          />
        );
      case 'table':
        return <SentimentTable data={data} loading={loading} />;
      case 'history':
        return (
          <SentimentHistory
            instruments={data.map((d) => ({ symbol: d.symbol }))}
            loading={loading}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-background-primary">
      <DashboardHeader
        onSearch={handleHeaderSearch}
        view={view}
        onViewChange={setView}
      />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        {/* Overview cards (only show on overview tab) */}
        {view === 'overview' && (
          <div className="mb-6">
            <OverviewCards
              data={newOverview}
              loading={loading}
              onSymbolClick={(symbol) => setSearch(symbol)}
            />
          </div>
        )}

        {/* Filters (only for table view - source and asset class) */}
        {view === 'table' && (
          <div className="mb-6">
            <FilterBar
              onSearchChange={() => {}}
              onSourceChange={setSource}
              onAssetClassChange={setAssetClass}
              sources={sources}
              hideSearch
            />
          </div>
        )}

        {/* Data view */}
        {renderView()}

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-border-primary/50 text-center">
          <p className="text-text-muted text-xs">
            Data sources: {sources.length > 0 ? sources.join(' · ') : 'None available'}
          </p>
          <p className="text-text-muted/70 text-xs mt-1">
            Weights: Myfxbook (2) · OANDA (2) · Dukascopy (1) · ForexFactory (1) · Forex.com (1)
          </p>
        </div>
      </main>
    </div>
  );
}
