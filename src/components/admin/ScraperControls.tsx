'use client';

import { useState, useEffect } from 'react';

interface ScraperStatus {
  name: string;
  canRun: boolean;
  waitTimeSeconds: number;
}

interface ScraperResult {
  success: boolean;
  source: string;
  instrumentCount?: number;
  error?: string;
  timestamp: string;
}

export default function ScraperControls() {
  const [status, setStatus] = useState<ScraperStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [lastResults, setLastResults] = useState<ScraperResult[]>([]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  async function fetchStatus() {
    try {
      const response = await fetch('/api/scrape');
      const data = await response.json();
      setStatus(data.status || []);
    } catch (err) {
      console.error('Failed to fetch scraper status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function runScraper(source?: string) {
    setRunning(source || 'all');
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source ? { source } : {}),
      });
      const data = await response.json();

      if (data.results) {
        setLastResults(data.results);
      } else if (data.source) {
        setLastResults([data]);
      }

      fetchStatus();
    } catch (err) {
      console.error('Failed to run scraper:', err);
    } finally {
      setRunning(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-surface-primary border border-border-primary rounded-lg p-6">
        <div className="text-text-secondary">Loading scraper status...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scraper Status */}
      <div className="bg-surface-primary border border-border-primary rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text-primary">Scraper Controls</h2>
          <button
            onClick={() => runScraper()}
            disabled={running !== null}
            className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/90 disabled:bg-accent-blue/50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {running === 'all' ? 'Running...' : 'Run All Scrapers'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {status.map((scraper) => (
            <div
              key={scraper.name}
              className="bg-background-primary rounded-lg p-4 border border-border-primary"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-text-primary capitalize">{scraper.name}</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    scraper.canRun
                      ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                      : 'bg-sentiment-neutral/20 text-sentiment-neutral'
                  }`}
                >
                  {scraper.canRun ? 'Ready' : `Wait ${scraper.waitTimeSeconds}s`}
                </span>
              </div>
              <button
                onClick={() => runScraper(scraper.name)}
                disabled={!scraper.canRun || running !== null}
                className="w-full py-2 bg-surface-secondary hover:bg-surface-hover disabled:opacity-50 border border-border-primary text-text-primary text-sm font-medium rounded-lg transition-colors"
              >
                {running === scraper.name ? 'Running...' : 'Run'}
              </button>
            </div>
          ))}
          {status.length === 0 && (
            <div className="col-span-full text-center text-text-muted py-4">
              No scrapers available
            </div>
          )}
        </div>
      </div>

      {/* Last Results */}
      {lastResults.length > 0 && (
        <div className="bg-surface-primary border border-border-primary rounded-lg p-6">
          <h3 className="text-lg font-semibold text-text-primary mb-4">Last Run Results</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-primary">
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Source</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Instruments</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-text-secondary">Time</th>
                </tr>
              </thead>
              <tbody>
                {lastResults.map((result, i) => (
                  <tr key={i} className="border-b border-border-primary/50">
                    <td className="py-3 px-4 text-sm text-text-primary capitalize">{result.source}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          result.success
                            ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                            : 'bg-sentiment-bearish/20 text-sentiment-bearish'
                        }`}
                      >
                        {result.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary">
                      {result.instrumentCount ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-muted">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
