'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';

interface VixData {
  chartData: {
    dates: string[];
    values: number[];
    ma90: number[];
  };
  riskStatus: {
    regime: 'Risk-on' | 'Neutral' | 'Risk-off';
    vixCurrent: number | null;
    vixMa90: number | null;
    vixTrending: string | null;
    justification: string | null;
  };
}

export default function RiskSentimentChart() {
  const [data, setData] = useState<VixData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/charts/vix');
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch VIX data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Transform data for chart
  const chartData = data?.chartData.dates.map((date, i) => ({
    date,
    vix: data.chartData.values[i],
    ma90: data.chartData.ma90[i],
  })) || [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background-secondary border border-border-primary rounded-lg p-3 shadow-lg">
          <p className="text-text-primary font-medium mb-2">{formatDate(label)}</p>
          <div className="space-y-1 text-sm">
            <p className="text-orange-400">VIX: {payload[0]?.value?.toFixed(2)}</p>
            <p className="text-blue-400">90-day MA: {payload[1]?.value?.toFixed(2)}</p>
          </div>
        </div>
      );
    }
    return null;
  };

  const getRegimeColor = (regime: string) => {
    switch (regime) {
      case 'Risk-on':
        return 'bg-sentiment-bullish/20 text-sentiment-bullish';
      case 'Risk-off':
        return 'bg-sentiment-bearish/20 text-sentiment-bearish';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Risk Sentiment (VIX)</h3>
          <p className="text-sm text-text-muted">VIX index with 90-day moving average</p>
        </div>
        {data?.riskStatus && (
          <div className={`px-4 py-2 rounded-lg font-medium ${getRegimeColor(data.riskStatus.regime)}`}>
            {data.riskStatus.regime.toUpperCase()}
          </div>
        )}
      </div>

      <div className="h-[400px]">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-muted">
            <div className="text-center">
              <p>No VIX data available</p>
              <p className="text-sm mt-1">Add FRED_API_KEY to enable VIX data</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="vixGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: '#2d3748' }}
                tickLine={{ stroke: '#2d3748' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 12 }}
                axisLine={{ stroke: '#2d3748' }}
                tickLine={{ stroke: '#2d3748' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="vix"
                stroke="#f97316"
                fill="url(#vixGradient)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="ma90"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Current status */}
      {data?.riskStatus && (
        <div className="mt-6 pt-4 border-t border-border-primary">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-text-muted uppercase tracking-wide">Current VIX</p>
              <p className="text-2xl font-mono text-orange-400">
                {data.riskStatus.vixCurrent?.toFixed(1) || 'N/A'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-muted uppercase tracking-wide">90-day MA</p>
              <p className="text-2xl font-mono text-blue-400">
                {data.riskStatus.vixMa90?.toFixed(1) || 'N/A'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-text-muted uppercase tracking-wide">Trend</p>
              <p className="text-2xl font-mono text-text-primary capitalize">
                {data.riskStatus.vixTrending || 'N/A'}
              </p>
            </div>
          </div>
          {data.riskStatus.justification && (
            <p className="text-sm text-text-muted text-center italic">
              {data.riskStatus.justification}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
