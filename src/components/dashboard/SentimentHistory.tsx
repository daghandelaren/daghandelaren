'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { computeContrarian } from '@/lib/sentiment/contrarian';

interface HistoryDataPoint {
  date: string;
  blendedLong: number;
  blendedShort: number;
  sourcesUsed: string[];
}

interface SentimentHistoryProps {
  instruments: { symbol: string }[];
  loading?: boolean;
}

type Timeframe = 'hourly' | 'daily';

export default function SentimentHistory({ instruments, loading }: SentimentHistoryProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>('daily');

  // Set default symbol when instruments load
  useEffect(() => {
    if (instruments.length > 0 && !selectedSymbol) {
      // Try to find EUR/USD first, otherwise use first instrument
      const eurUsd = instruments.find((i) => i.symbol === 'EUR/USD');
      setSelectedSymbol(eurUsd?.symbol || instruments[0].symbol);
    }
  }, [instruments, selectedSymbol]);

  // Fetch history when symbol or timeframe changes
  useEffect(() => {
    if (!selectedSymbol) return;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const params = new URLSearchParams({
          symbol: selectedSymbol,
          interval: timeframe,
        });

        if (timeframe === 'hourly') {
          params.set('hours', '12');
        } else {
          params.set('days', '14');
        }

        const response = await fetch(`/api/sentiment/history?${params.toString()}`);
        const json = await response.json();
        setHistoryData(json.history || []);
      } catch (error) {
        console.error('Failed to fetch history:', error);
        setHistoryData([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [selectedSymbol, timeframe]);

  // Get current contrarian signal
  const currentData = historyData[historyData.length - 1];
  const contrarian = currentData
    ? computeContrarian(currentData.blendedLong, currentData.blendedShort)
    : null;

  // Format date for display based on timeframe
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (timeframe === 'hourly') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get subtitle text based on timeframe
  const getSubtitle = () => {
    if (timeframe === 'hourly') {
      return 'Hourly sentiment over the last 12 hours';
    }
    return 'Daily sentiment over the last 14 days';
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // payload[0] = blendedLong (first bar), payload[1] = blendedShort (second bar)
      const longPct = payload[0]?.value || 0;
      const shortPct = payload[1]?.value || 0;
      const signal = computeContrarian(longPct, shortPct);

      return (
        <div className="bg-background-secondary border border-border-primary rounded-lg p-3 shadow-lg">
          <p className="text-text-primary font-medium mb-2">{formatDate(label)}</p>
          <div className="space-y-1 text-sm">
            <p className="text-sentiment-bullish">Long: {longPct.toFixed(1)}%</p>
            <p className="text-sentiment-bearish">Short: {shortPct.toFixed(1)}%</p>
            <p
              className={`font-medium ${
                signal.label === 'BULLISH'
                  ? 'text-sentiment-bullish'
                  : signal.label === 'BEARISH'
                    ? 'text-sentiment-bearish'
                    : 'text-gray-400'
              }`}
            >
              Signal: {signal.label === 'NEUTRAL' ? 'MIXED' : signal.label}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-surface-secondary rounded mb-4" />
          <div className="h-[400px] bg-surface-secondary rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      {/* Header with instrument selector and timeframe toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Sentiment History</h3>
          <p className="text-sm text-text-muted">{getSubtitle()}</p>
        </div>

        <div className="flex items-center gap-4">
          {/* Timeframe toggle */}
          <div className="flex rounded-lg border border-border-primary overflow-hidden">
            <button
              onClick={() => setTimeframe('hourly')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                timeframe === 'hourly'
                  ? 'bg-accent-blue text-white'
                  : 'bg-surface-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              1H
            </button>
            <button
              onClick={() => setTimeframe('daily')}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                timeframe === 'daily'
                  ? 'bg-accent-blue text-white'
                  : 'bg-surface-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              1D
            </button>
          </div>

          {/* Current signal display */}
          {contrarian && (
            <div
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                contrarian.label === 'BULLISH'
                  ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                  : contrarian.label === 'BEARISH'
                    ? 'bg-sentiment-bearish/20 text-sentiment-bearish'
                    : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {contrarian.label === 'NEUTRAL' ? 'MIXED' : contrarian.label}
            </div>
          )}

          {/* Instrument selector */}
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
          >
            {instruments.map((inst) => (
              <option key={inst.symbol} value={inst.symbol}>
                {inst.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-sentiment-bullish" />
          <span className="text-sm text-text-secondary">Long</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-sentiment-bearish" />
          <span className="text-sm text-text-secondary">Short</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[400px]">
        {historyLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
          </div>
        ) : historyData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-muted">
            <div className="text-center">
              <p>No historical data available for {selectedSymbol}</p>
              <p className="text-sm mt-1">Data will accumulate over time as scrapers run</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={historyData}
              margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
              barCategoryGap={1}
            >
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#2d3748' }}
                tickLine={{ stroke: '#2d3748' }}
                angle={timeframe === 'daily' ? -45 : 0}
                textAnchor={timeframe === 'daily' ? 'end' : 'middle'}
                height={timeframe === 'daily' ? 60 : 30}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={{ stroke: '#2d3748' }}
                tickLine={{ stroke: '#2d3748' }}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <ReferenceLine
                y={50}
                stroke="#ffffff"
                strokeDasharray="5 5"
                strokeWidth={1}
              />
              {/* Stacked bars: Long on bottom (green), Short on top (red) */}
              <Bar dataKey="blendedLong" stackId="sentiment" fill="#16c784" radius={[0, 0, 0, 0]} />
              <Bar dataKey="blendedShort" stackId="sentiment" fill="#ea3943" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Current values display */}
      {currentData && (
        <div className="mt-4 pt-4 border-t border-border-primary">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-xs text-text-muted uppercase tracking-wide">Current Long</p>
              <p className="text-2xl font-mono text-sentiment-bullish">{currentData.blendedLong.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-muted uppercase tracking-wide">Current Short</p>
              <p className="text-2xl font-mono text-sentiment-bearish">{currentData.blendedShort.toFixed(1)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-muted uppercase tracking-wide">Strength</p>
              <p className="text-2xl font-mono text-text-primary">{contrarian?.strength.toFixed(0)}pp</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
