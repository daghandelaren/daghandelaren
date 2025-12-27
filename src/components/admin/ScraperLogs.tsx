'use client';

import { useState, useEffect } from 'react';

interface ScraperLog {
  id: string;
  timestamp: string;
  totalScrapers: number;
  successCount: number;
  failedCount: number;
  instrumentCount: number;
  failedScrapers: string[];
  errorMessages: string[];
  deletedSnapshots: number;
}

export default function ScraperLogs() {
  const [logs, setLogs] = useState<ScraperLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
    // Refresh every 5 minutes
    const interval = setInterval(fetchLogs, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchLogs() {
    try {
      const response = await fetch('/api/admin/scraper-logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(timestamp: string) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  function formatDate(timestamp: string) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getStatusColor(log: ScraperLog) {
    if (log.failedCount === 0) return 'text-sentiment-bullish';
    if (log.failedCount === log.totalScrapers) return 'text-sentiment-bearish';
    return 'text-sentiment-neutral';
  }

  function getStatusBg(log: ScraperLog) {
    if (log.failedCount === 0) return 'bg-sentiment-bullish/10';
    if (log.failedCount === log.totalScrapers) return 'bg-sentiment-bearish/10';
    return 'bg-sentiment-neutral/10';
  }

  if (loading) {
    return (
      <div className="bg-surface-primary border border-border-primary rounded-lg p-8">
        <div className="text-text-secondary text-center">Loading scraper logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Scraper Logs</h2>
          <p className="text-text-muted text-sm">Last 12 hours of scraper activity</p>
        </div>
        <button
          onClick={fetchLogs}
          className="px-3 py-1.5 bg-surface-secondary border border-border-primary rounded-lg text-text-secondary text-sm hover:bg-surface-hover transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="bg-surface-primary border border-border-primary rounded-lg overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            No scraper logs yet. Logs will appear after the first hourly scrape.
          </div>
        ) : (
          <div className="divide-y divide-border-primary">
            {logs.map((log) => (
              <div key={log.id} className={`${getStatusBg(log)}`}>
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-surface-hover/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div className={`w-2 h-2 rounded-full ${log.failedCount === 0 ? 'bg-sentiment-bullish' : log.failedCount === log.totalScrapers ? 'bg-sentiment-bearish' : 'bg-sentiment-neutral'}`} />

                    {/* Time */}
                    <div className="text-left">
                      <span className="text-text-primary font-medium">{formatTime(log.timestamp)}</span>
                      <span className="text-text-muted text-sm ml-2">{formatDate(log.timestamp)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <span className={getStatusColor(log)}>
                        {log.successCount}/{log.totalScrapers} scrapers
                      </span>
                      <span className="text-text-secondary">
                        {log.instrumentCount} instruments
                      </span>
                      {log.deletedSnapshots > 0 && (
                        <span className="text-text-muted">
                          {log.deletedSnapshots} cleaned
                        </span>
                      )}
                    </div>

                    {/* Expand icon */}
                    <svg
                      className={`w-4 h-4 text-text-muted transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded details */}
                {expandedLog === log.id && log.failedCount > 0 && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="bg-surface-secondary rounded-lg p-3 ml-6">
                      <p className="text-sm font-medium text-sentiment-bearish mb-2">
                        Failed Scrapers:
                      </p>
                      <ul className="space-y-1">
                        {log.failedScrapers.map((scraper, idx) => (
                          <li key={idx} className="text-sm text-text-secondary flex items-start gap-2">
                            <span className="text-sentiment-bearish">•</span>
                            <span>
                              <span className="font-medium">{scraper}:</span>{' '}
                              <span className="text-text-muted">{log.errorMessages[idx]}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Show success message when expanded and all succeeded */}
                {expandedLog === log.id && log.failedCount === 0 && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="bg-sentiment-bullish/10 rounded-lg p-3 ml-6">
                      <p className="text-sm text-sentiment-bullish">
                        All {log.totalScrapers} scrapers completed successfully
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
