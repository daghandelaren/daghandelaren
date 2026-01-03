'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface YieldData {
  chartData: {
    dates: string[];
    currencies: Record<string, number[]>;
    differentials: Record<string, number[]>;
    ma20: Record<string, (number | null)[]>;
    ma60: Record<string, (number | null)[]>;
  };
  currentSignals: {
    currency: string;
    yield2Y: number | null;
    differential: number | null;
    ma20: number | null;
    ma60: number | null;
    band: number;
    signal: number;
  }[];
}

const CURRENCY_COLORS: Record<string, string> = {
  USD: '#94a3b8',
  EUR: '#3b82f6',
  GBP: '#8b5cf6',
  JPY: '#ef4444',
  CHF: '#f97316',
  AUD: '#22c55e',
  NZD: '#06b6d4',
  CAD: '#eab308',
};

const CURRENCY_EXPLANATIONS: Record<string, { title: string; description: string; central_bank: string }> = {
  USD: {
    title: 'US 2Y Treasury Yield',
    description: 'The global benchmark for risk-free rates. US Treasuries are considered the safest assets in the world, making this yield the foundation for pricing all other assets.',
    central_bank: 'Federal Reserve (Fed)',
  },
  EUR: {
    title: 'Germany 2Y Bund Yield',
    description: 'Reflects ECB monetary policy expectations. German Bunds serve as the eurozone benchmark due to Germany\'s economic strength and fiscal discipline.',
    central_bank: 'European Central Bank (ECB)',
  },
  GBP: {
    title: 'UK 2Y Gilt Yield',
    description: 'Reflects Bank of England rate expectations. UK Gilts are sensitive to domestic inflation data and BoE forward guidance.',
    central_bank: 'Bank of England (BoE)',
  },
  JPY: {
    title: 'Japan 2Y JGB Yield',
    description: 'Reflects Bank of Japan policy stance. Historically very low or negative due to decades of deflation and ultra-loose monetary policy.',
    central_bank: 'Bank of Japan (BoJ)',
  },
  CHF: {
    title: 'Switzerland 2Y Bond Yield',
    description: 'Reflects SNB policy decisions. Often negative due to Switzerland\'s safe-haven status and the SNB\'s efforts to prevent excessive CHF appreciation.',
    central_bank: 'Swiss National Bank (SNB)',
  },
  AUD: {
    title: 'Australia 2Y Bond Yield',
    description: 'Reflects RBA rate expectations. Sensitive to commodity prices, China\'s economic outlook, and domestic housing market conditions.',
    central_bank: 'Reserve Bank of Australia (RBA)',
  },
  NZD: {
    title: 'New Zealand 2Y Bond Yield',
    description: 'Reflects RBNZ rate expectations. Influenced by dairy prices, housing market dynamics, and the bank\'s inflation targeting mandate.',
    central_bank: 'Reserve Bank of New Zealand (RBNZ)',
  },
  CAD: {
    title: 'Canada 2Y Bond Yield',
    description: 'Reflects Bank of Canada rate expectations. Closely tied to oil prices, US economic conditions, and domestic housing market health.',
    central_bank: 'Bank of Canada (BoC)',
  },
};

type ViewMode = 'differential' | 'absolute';

export default function YieldDifferentialsChart() {
  const [data, setData] = useState<YieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('differential');
  const [showMA, setShowMA] = useState(false);
  const [modalCurrency, setModalCurrency] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/charts/yields');
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch yield data:', error);
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

  // Transform data for differential view
  const differentialChartData = data?.chartData.dates.map((date, i) => {
    const point: Record<string, any> = { date };
    Object.keys(data.chartData.differentials).forEach((currency) => {
      if (currency !== 'USD' && data.chartData.differentials[currency][i] !== undefined) {
        point[currency] = data.chartData.differentials[currency][i];
      }
      // Add MA values
      if (currency !== 'USD' && data.chartData.ma20?.[currency]?.[i] !== null) {
        point[`${currency}_MA20`] = data.chartData.ma20[currency][i];
      }
      if (currency !== 'USD' && data.chartData.ma60?.[currency]?.[i] !== null) {
        point[`${currency}_MA60`] = data.chartData.ma60[currency][i];
      }
    });
    return point;
  }) || [];

  // Transform data for absolute yields view
  const absoluteChartData = data?.chartData.dates.map((date, i) => {
    const point: Record<string, any> = { date };
    Object.keys(data.chartData.currencies).forEach((currency) => {
      if (data.chartData.currencies[currency][i] !== undefined) {
        point[currency] = data.chartData.currencies[currency][i];
      }
    });
    return point;
  }) || [];

  const chartData = viewMode === 'differential' ? differentialChartData : absoluteChartData;
  const currencies = viewMode === 'differential'
    ? Object.keys(CURRENCY_COLORS).filter(c => c !== 'USD')
    : Object.keys(CURRENCY_COLORS);

  const closeModal = useCallback(() => setModalCurrency(null), []);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (modalCurrency) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [modalCurrency, closeModal]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background-secondary border border-border-primary rounded-lg p-3 shadow-lg backdrop-blur-sm">
          <p className="text-text-primary font-medium mb-2">{formatDate(label)}</p>
          <div className="space-y-1 text-sm">
            {payload.map((entry: any) => (
              <p key={entry.dataKey} style={{ color: entry.color }}>
                {entry.dataKey}: {entry.value?.toFixed(2)}%
              </p>
            ))}
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
    <>
      <div className="card p-6">
        <div className="flex flex-col gap-4 mb-6">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                {viewMode === 'differential' ? '2Y Yield Differentials vs USD' : '2Y Government Bond Yields'}
              </h3>
              <p className="text-sm text-text-muted">
                {viewMode === 'differential'
                  ? 'Currency 2Y yield minus US 2Y yield (90 days)'
                  : 'Absolute 2Y government bond yields (90 days)'}
              </p>
            </div>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
            >
              <option value="all">All Currencies</option>
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">View:</span>
              <div className="inline-flex rounded-lg bg-surface-secondary p-1">
                <button
                  onClick={() => setViewMode('differential')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    viewMode === 'differential'
                      ? 'bg-accent-blue text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Differentials
                </button>
                <button
                  onClick={() => setViewMode('absolute')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    viewMode === 'absolute'
                      ? 'bg-accent-blue text-white shadow-sm'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  Absolute Yields
                </button>
              </div>
            </div>

            {/* MA Toggle - only show for differential view */}
            {viewMode === 'differential' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setShowMA(!showMA)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    showMA ? 'bg-accent-blue' : 'bg-surface-secondary'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      showMA ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
                <span className="text-xs text-text-muted">Show MA20/60</span>
              </label>
            )}
          </div>
        </div>

        <div className="h-[400px]">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <p>No yield data available</p>
                <p className="text-sm mt-1">Data will appear after the scheduler runs</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                {viewMode === 'differential' && (
                  <ReferenceLine y={0} stroke="#ffffff" strokeDasharray="5 5" strokeWidth={1} />
                )}
                {currencies.map((currency) => (
                  (selectedCurrency === 'all' || selectedCurrency === currency) && (
                    <Line
                      key={currency}
                      type="monotone"
                      dataKey={currency}
                      stroke={CURRENCY_COLORS[currency]}
                      strokeWidth={2}
                      dot={false}
                      name={currency}
                      connectNulls={true}
                    />
                  )
                ))}
                {/* MA Lines - only for differential view when toggle is on */}
                {viewMode === 'differential' && showMA && currencies.filter(c => c !== 'USD').map((currency) => (
                  (selectedCurrency === 'all' || selectedCurrency === currency) && (
                    <>
                      <Line
                        key={`${currency}_MA20`}
                        type="monotone"
                        dataKey={`${currency}_MA20`}
                        stroke={CURRENCY_COLORS[currency]}
                        strokeWidth={1.5}
                        strokeDasharray="4 2"
                        dot={false}
                        name={`${currency} MA20`}
                        connectNulls={true}
                        opacity={0.7}
                      />
                      <Line
                        key={`${currency}_MA60`}
                        type="monotone"
                        dataKey={`${currency}_MA60`}
                        stroke={CURRENCY_COLORS[currency]}
                        strokeWidth={1}
                        strokeDasharray="8 4"
                        dot={false}
                        name={`${currency} MA60`}
                        connectNulls={true}
                        opacity={0.5}
                      />
                    </>
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Current signals table */}
        {data?.currentSignals && (
          <div className="mt-6 pt-4 border-t border-border-primary">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-medium text-text-primary">Spread Momentum (MA20 vs MA60)</h4>
              <span className="text-xs text-text-muted">Click for details</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {data.currentSignals
                .filter((s) => viewMode === 'absolute' || s.currency !== 'USD')
                .map((signal) => (
                  <button
                    key={signal.currency}
                    onClick={() => setModalCurrency(signal.currency)}
                    className="bg-surface-secondary rounded-lg p-3 text-center transition-all duration-200 hover:bg-surface-secondary/80 hover:scale-[1.02] hover:shadow-lg cursor-pointer border border-transparent hover:border-border-primary"
                  >
                    <p className="text-sm font-medium" style={{ color: CURRENCY_COLORS[signal.currency] }}>
                      {signal.currency}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {viewMode === 'differential'
                        ? (signal.differential !== null ? `${signal.differential.toFixed(2)}%` : 'N/A')
                        : (signal.yield2Y !== null ? `${signal.yield2Y.toFixed(2)}%` : 'N/A')}
                    </p>
                    <div
                      className={`mt-2 text-xs font-medium px-2 py-1 rounded ${
                        signal.signal === 1
                          ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                          : signal.signal === -1
                            ? 'bg-sentiment-bearish/20 text-sentiment-bearish'
                            : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {signal.signal === 1 ? 'IMPROVING' : signal.signal === -1 ? 'DETERIORATING' : 'FLAT'}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Currency explanation modal */}
      {modalCurrency && CURRENCY_EXPLANATIONS[modalCurrency] && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-background-secondary border border-border-primary rounded-xl max-w-md w-full shadow-2xl transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-border-primary">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CURRENCY_COLORS[modalCurrency] }}
                />
                <span className="text-lg font-semibold text-text-primary">{modalCurrency}</span>
              </div>
              <button
                onClick={closeModal}
                className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-surface-secondary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* Modal content */}
            <div className="p-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-text-primary mb-1">
                  {CURRENCY_EXPLANATIONS[modalCurrency].title}
                </h4>
                <p className="text-sm text-text-muted leading-relaxed">
                  {CURRENCY_EXPLANATIONS[modalCurrency].description}
                </p>
              </div>

              <div className="bg-surface-secondary rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <path d="M3 21h18"></path>
                    <path d="M3 10h18"></path>
                    <path d="M5 6l7-3 7 3"></path>
                    <path d="M4 10v11"></path>
                    <path d="M20 10v11"></path>
                    <path d="M8 14v3"></path>
                    <path d="M12 14v3"></path>
                    <path d="M16 14v3"></path>
                  </svg>
                  <span className="text-xs text-text-muted">Central Bank</span>
                </div>
                <p className="text-sm font-medium text-text-primary mt-1">
                  {CURRENCY_EXPLANATIONS[modalCurrency].central_bank}
                </p>
              </div>

              {/* Current data */}
              {data?.currentSignals && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {(() => {
                      const signal = data.currentSignals.find(s => s.currency === modalCurrency);
                      if (!signal) return null;
                      return (
                        <>
                          <div className="bg-surface-secondary rounded-lg p-3">
                            <span className="text-xs text-text-muted">Current Yield</span>
                            <p className="text-lg font-semibold text-text-primary">
                              {signal.yield2Y !== null ? `${signal.yield2Y.toFixed(2)}%` : 'N/A'}
                            </p>
                          </div>
                          <div className="bg-surface-secondary rounded-lg p-3">
                            <span className="text-xs text-text-muted">vs USD</span>
                            <p className="text-lg font-semibold text-text-primary">
                              {signal.differential !== null
                                ? `${signal.differential >= 0 ? '+' : ''}${signal.differential.toFixed(2)}%`
                                : 'N/A'}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {(() => {
                    const signal = data.currentSignals.find(s => s.currency === modalCurrency);
                    if (!signal) return null;
                    return (
                      <div className="space-y-3">
                        {/* MA Values */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-surface-secondary rounded-lg p-3">
                            <span className="text-xs text-text-muted">MA20 (Spread)</span>
                            <p className="text-sm font-semibold text-text-primary">
                              {signal.ma20 !== null ? `${signal.ma20 >= 0 ? '+' : ''}${signal.ma20.toFixed(3)}%` : 'N/A'}
                            </p>
                          </div>
                          <div className="bg-surface-secondary rounded-lg p-3">
                            <span className="text-xs text-text-muted">MA60 (Spread)</span>
                            <p className="text-sm font-semibold text-text-primary">
                              {signal.ma60 !== null ? `${signal.ma60 >= 0 ? '+' : ''}${signal.ma60.toFixed(3)}%` : 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Signal */}
                        <div className="bg-surface-secondary rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-xs text-text-muted">Spread Momentum vs USD</span>
                              <div
                                className={`mt-1 text-sm font-medium px-2 py-0.5 rounded inline-block ${
                                  signal.signal === 1
                                    ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                                    : signal.signal === -1
                                      ? 'bg-sentiment-bearish/20 text-sentiment-bearish'
                                      : 'bg-gray-500/20 text-gray-400'
                                }`}
                              >
                                {signal.signal === 1 ? 'IMPROVING' : signal.signal === -1 ? 'DETERIORATING' : 'FLAT'}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-text-muted">Band</span>
                              <p className="text-xs font-mono text-text-primary">±{signal.band.toFixed(3)}% ({(signal.band * 100).toFixed(1)} bps)</p>
                            </div>
                          </div>
                          <p className="text-xs text-text-muted mt-2">
                            {signal.signal === 1
                              ? `The yield spread is narrowing vs USD (MA20 > MA60 + band). Supportive for ${modalCurrency} relative to USD.`
                              : signal.signal === -1
                                ? `The yield spread is widening vs USD (MA20 < MA60 - band). Headwind for ${modalCurrency} relative to USD.`
                                : `The yield spread is stable within the volatility band (±${signal.band.toFixed(3)}% / ${(signal.band * 100).toFixed(1)} bps). No clear directional bias vs USD.`}
                          </p>
                        </div>

                        {/* Methodology explanation */}
                        <div className="border-t border-border-primary pt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-blue">
                              <circle cx="12" cy="12" r="10"></circle>
                              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                              <line x1="12" y1="17" x2="12.01" y2="17"></line>
                            </svg>
                            <span className="text-xs font-medium text-text-primary">How It Works</span>
                          </div>
                          <div className="text-[11px] text-text-muted space-y-1.5">
                            <p><span className="text-text-primary font-medium">Spread:</span> {modalCurrency} 2Y yield − USD 2Y yield</p>
                            <p><span className="text-text-primary font-medium">MA20/MA60:</span> Moving averages of the spread</p>
                            <p><span className="text-text-primary font-medium">Band:</span> Volatility-scaled threshold = max(3 bps, 0.25 × stdev)</p>
                            <div className="bg-background-secondary rounded p-2 mt-2">
                              <p className="text-accent-blue">• MA20 &gt; MA60 + band → <span className="text-sentiment-bullish">IMPROVING</span></p>
                              <p className="text-accent-blue">• MA20 &lt; MA60 − band → <span className="text-sentiment-bearish">DETERIORATING</span></p>
                              <p className="text-accent-blue">• Otherwise → <span className="text-gray-400">FLAT</span></p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-4 pb-4">
              <button
                onClick={closeModal}
                className="w-full py-2 bg-surface-secondary hover:bg-surface-secondary/80 text-text-primary text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
