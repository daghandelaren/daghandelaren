'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CommodityData {
  chartData: {
    dates: string[];
    commodities: Record<string, (number | null)[]>;
    ma90: Record<string, (number | null)[]>;
  };
  currencySignals: {
    currency: string;
    commodityTailwind: string;
    commodityBasket: number | null;
    commodityMa90: number | null;
    commodityAdj: number;
  }[];
}

const COMMODITY_COLORS: Record<string, string> = {
  IRON_ORE: '#ef4444',
  COPPER: '#f97316',
  OIL_WTI: '#84cc16',
  DAIRY: '#22c55e',
};

const COMMODITY_NAMES: Record<string, string> = {
  IRON_ORE: 'Iron Ore',
  COPPER: 'Copper',
  OIL_WTI: 'WTI Oil',
  DAIRY: 'Dairy',
};

const COMMODITY_EXPLANATIONS: Record<string, { title: string; description: string; unit: string; relevance: string }> = {
  IRON_ORE: {
    title: 'Iron Ore (62% Fe CFR China)',
    description: 'The primary raw material for steel production. Prices are heavily influenced by Chinese demand, which accounts for ~70% of global seaborne imports.',
    unit: 'USD per metric ton',
    relevance: 'Key driver for AUD. Australia is the world\'s largest iron ore exporter, with mining contributing significantly to GDP and exports.',
  },
  COPPER: {
    title: 'Copper (LME Grade A)',
    description: 'Essential industrial metal used in construction, electronics, and renewable energy. Often called "Dr. Copper" as its price reflects global economic health.',
    unit: 'USD per metric ton',
    relevance: 'Important for AUD. Australia is a major copper producer, and prices reflect global industrial demand and China\'s economic activity.',
  },
  OIL_WTI: {
    title: 'WTI Crude Oil',
    description: 'West Texas Intermediate - the US benchmark for crude oil. Prices are influenced by OPEC+ decisions, geopolitical events, and global demand.',
    unit: 'USD per barrel',
    relevance: 'Primary driver for CAD. Canada\'s oil sands make it the 4th largest oil producer globally, with energy exports critical to its economy.',
  },
  DAIRY: {
    title: 'Global Dairy Trade (GDT) Index',
    description: 'Weighted average of dairy product prices from the GDT auction. New Zealand dominates global dairy exports through Fonterra cooperative.',
    unit: 'USD per metric ton (whole milk powder)',
    relevance: 'Key driver for NZD. Dairy accounts for ~25% of New Zealand\'s export earnings, making it highly sensitive to global dairy prices.',
  },
};

const CURRENCY_COMMODITY_EXPLANATIONS: Record<string, { title: string; description: string; commodities: string[] }> = {
  AUD: {
    title: 'Australian Dollar - Commodity Exposure',
    description: 'Australia\'s economy is heavily dependent on commodity exports, particularly to China. The RBA monitors commodity prices as a key input for monetary policy decisions.',
    commodities: ['IRON_ORE', 'COPPER'],
  },
  CAD: {
    title: 'Canadian Dollar - Oil Dependency',
    description: 'Canada\'s oil sands in Alberta make energy exports a major economic driver. The CAD often trades as a "petrocurrency", moving with oil prices.',
    commodities: ['OIL_WTI'],
  },
  NZD: {
    title: 'New Zealand Dollar - Dairy Economy',
    description: 'New Zealand is the world\'s largest dairy exporter. Fonterra\'s GDT auctions directly impact NZD sentiment and trade balance expectations.',
    commodities: ['DAIRY'],
  },
};

export default function CommoditiesChart() {
  const [data, setData] = useState<CommodityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCommodity, setSelectedCommodity] = useState<string>('all');
  const [showMA, setShowMA] = useState(false);
  const [modalType, setModalType] = useState<'commodity' | 'currency' | null>(null);
  const [modalKey, setModalKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/charts/commodities');
        const json = await res.json();
        if (json.success) {
          setData(json);
        }
      } catch (error) {
        console.error('Failed to fetch commodity data:', error);
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

  const closeModal = useCallback(() => {
    setModalType(null);
    setModalKey(null);
  }, []);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (modalKey) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [modalKey, closeModal]);

  // Find first non-null value for each commodity to use as normalization base
  const baseValues: Record<string, number> = {};
  Object.keys(COMMODITY_COLORS).forEach((commodity) => {
    const prices = data?.chartData.commodities[commodity];
    if (prices) {
      const firstNonNull = prices.find(p => p !== null);
      if (firstNonNull !== undefined) {
        baseValues[commodity] = firstNonNull;
      }
    }
  });

  // Find first non-null MA value for normalization
  const maBaseValues: Record<string, number> = {};
  Object.keys(COMMODITY_COLORS).forEach((commodity) => {
    const mas = data?.chartData.ma90[commodity];
    if (mas) {
      const firstNonNull = mas.find(p => p !== null);
      if (firstNonNull !== undefined) {
        maBaseValues[commodity] = firstNonNull;
      }
    }
  });

  // Transform data for chart - normalize prices to 100 at start for comparison
  const chartData = data?.chartData.dates.map((date, i) => {
    const point: Record<string, any> = { date };
    Object.keys(COMMODITY_COLORS).forEach((commodity) => {
      const prices = data.chartData.commodities[commodity];
      const price = prices?.[i];
      if (price !== null && price !== undefined && baseValues[commodity]) {
        point[commodity] = (price / baseValues[commodity]) * 100;
      }
      // Add normalized MA values
      const mas = data.chartData.ma90[commodity];
      const ma = mas?.[i];
      if (ma !== null && ma !== undefined && maBaseValues[commodity]) {
        point[`${commodity}_MA`] = (ma / maBaseValues[commodity]) * 100;
      }
    });
    return point;
  }) || [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background-secondary border border-border-primary rounded-lg p-3 shadow-lg backdrop-blur-sm">
          <p className="text-text-primary font-medium mb-2">{formatDate(label)}</p>
          <div className="space-y-1 text-sm">
            {payload.map((entry: any) => (
              <p key={entry.dataKey} style={{ color: entry.color }}>
                {COMMODITY_NAMES[entry.dataKey]}: {entry.value?.toFixed(1)}
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

  const commodities = Object.keys(COMMODITY_COLORS);

  return (
    <>
      <div className="card p-6">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary">Commodity Prices</h3>
              <p className="text-sm text-text-muted">Normalized prices (base = 100) over 90 days</p>
            </div>
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="bg-surface-secondary border border-border-primary rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue"
            >
              <option value="all">All Commodities</option>
              {commodities.map((c) => (
                <option key={c} value={c}>{COMMODITY_NAMES[c]}</option>
              ))}
            </select>
          </div>

          {/* MA Toggle */}
          <div className="flex items-center gap-2">
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
              <span className="text-xs text-text-muted">Show 90-Day MA</span>
            </label>
          </div>
        </div>

        {/* Commodity legend with click for details */}
        <div className="flex flex-wrap gap-3 mb-4">
          {commodities.map((commodity) => (
            <button
              key={commodity}
              onClick={() => {
                setModalType('commodity');
                setModalKey(commodity);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-lg hover:bg-surface-secondary/80 transition-colors cursor-pointer"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COMMODITY_COLORS[commodity] }}
              />
              <span className="text-xs text-text-primary">{COMMODITY_NAMES[commodity]}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </button>
          ))}
        </div>

        <div className="h-[400px]">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <p>No commodity data available</p>
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
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                {commodities.map((commodity) => (
                  (selectedCommodity === 'all' || selectedCommodity === commodity) && (
                    <Line
                      key={commodity}
                      type="monotone"
                      dataKey={commodity}
                      stroke={COMMODITY_COLORS[commodity]}
                      strokeWidth={2}
                      dot={false}
                      name={COMMODITY_NAMES[commodity]}
                      connectNulls={true}
                    />
                  )
                ))}
                {/* MA Lines - dashed, shown when toggle is on */}
                {showMA && commodities.map((commodity) => (
                  (selectedCommodity === 'all' || selectedCommodity === commodity) && (
                    <Line
                      key={`${commodity}_MA`}
                      type="monotone"
                      dataKey={`${commodity}_MA`}
                      stroke={COMMODITY_COLORS[commodity]}
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                      name={`${COMMODITY_NAMES[commodity]} MA90`}
                      connectNulls={true}
                      opacity={0.6}
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Currency signals */}
        {data?.currencySignals && data.currencySignals.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border-primary">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-medium text-text-primary">Commodity Currency Signals</h4>
              <span className="text-xs text-text-muted">Click for details</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {data.currencySignals.map((signal) => (
                <button
                  key={signal.currency}
                  onClick={() => {
                    setModalType('currency');
                    setModalKey(signal.currency);
                  }}
                  className="bg-surface-secondary rounded-lg p-4 text-center transition-all duration-200 hover:bg-surface-secondary/80 hover:scale-[1.02] hover:shadow-lg cursor-pointer border border-transparent hover:border-border-primary"
                >
                  <p className="text-lg font-medium text-text-primary">{signal.currency}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {signal.currency === 'AUD' ? 'Iron Ore + Copper' :
                     signal.currency === 'CAD' ? 'WTI Oil' :
                     signal.currency === 'NZD' ? 'Dairy' : ''}
                  </p>
                  <div
                    className={`mt-3 text-sm font-medium px-3 py-1.5 rounded ${
                      signal.commodityTailwind === 'Yes'
                        ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                        : signal.commodityTailwind === 'No'
                          ? 'bg-sentiment-bearish/20 text-sentiment-bearish'
                          : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {signal.commodityTailwind === 'Yes' ? 'TAILWIND' :
                     signal.commodityTailwind === 'No' ? 'HEADWIND' : 'NEUTRAL'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Commodity explanation modal */}
      {modalType === 'commodity' && modalKey && COMMODITY_EXPLANATIONS[modalKey] && (
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
                  style={{ backgroundColor: COMMODITY_COLORS[modalKey] }}
                />
                <span className="text-lg font-semibold text-text-primary">{COMMODITY_NAMES[modalKey]}</span>
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
                  {COMMODITY_EXPLANATIONS[modalKey].title}
                </h4>
                <p className="text-sm text-text-muted leading-relaxed">
                  {COMMODITY_EXPLANATIONS[modalKey].description}
                </p>
              </div>

              <div className="bg-surface-secondary rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                  <span className="text-xs text-text-muted">Price Unit</span>
                </div>
                <p className="text-sm font-medium text-text-primary mt-1">
                  {COMMODITY_EXPLANATIONS[modalKey].unit}
                </p>
              </div>

              <div className="bg-surface-secondary rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="2" y1="12" x2="22" y2="12"></line>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                  </svg>
                  <span className="text-xs text-text-muted">FX Relevance</span>
                </div>
                <p className="text-sm text-text-muted mt-1 leading-relaxed">
                  {COMMODITY_EXPLANATIONS[modalKey].relevance}
                </p>
              </div>
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

      {/* Currency commodity explanation modal */}
      {modalType === 'currency' && modalKey && CURRENCY_COMMODITY_EXPLANATIONS[modalKey] && (
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
                <span className="text-lg font-semibold text-text-primary">{modalKey}</span>
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
                  {CURRENCY_COMMODITY_EXPLANATIONS[modalKey].title}
                </h4>
                <p className="text-sm text-text-muted leading-relaxed">
                  {CURRENCY_COMMODITY_EXPLANATIONS[modalKey].description}
                </p>
              </div>

              <div>
                <span className="text-xs text-text-muted">Tracked Commodities</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CURRENCY_COMMODITY_EXPLANATIONS[modalKey].commodities.map((commodity) => (
                    <div
                      key={commodity}
                      className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-lg"
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: COMMODITY_COLORS[commodity] }}
                      />
                      <span className="text-sm text-text-primary">{COMMODITY_NAMES[commodity]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Current signal */}
              {data?.currencySignals && (() => {
                const signal = data.currencySignals.find(s => s.currency === modalKey);
                if (!signal) return null;
                return (
                  <>
                    <div className="bg-surface-secondary rounded-lg p-3">
                      <span className="text-xs text-text-muted">Current Signal</span>
                      <div className="flex items-center justify-between mt-2">
                        <div
                          className={`text-sm font-medium px-3 py-1 rounded ${
                            signal.commodityTailwind === 'Yes'
                              ? 'bg-sentiment-bullish/20 text-sentiment-bullish'
                              : signal.commodityTailwind === 'No'
                                ? 'bg-sentiment-bearish/20 text-sentiment-bearish'
                                : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {signal.commodityTailwind === 'Yes' ? 'TAILWIND' :
                           signal.commodityTailwind === 'No' ? 'HEADWIND' : 'NEUTRAL'}
                        </div>
                      </div>
                      <p className="text-xs text-text-muted mt-2">
                        {signal.commodityTailwind === 'Yes'
                          ? 'Rising commodity prices support the currency'
                          : signal.commodityTailwind === 'No'
                            ? 'Falling commodity prices weigh on the currency'
                            : 'Commodity prices are neutral for the currency'}
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
                        <p><span className="text-text-primary font-medium">Basket:</span> {modalKey === 'AUD' ? 'Average of Iron Ore + Copper' : modalKey === 'CAD' ? 'WTI Oil price' : 'Dairy (GDT) price'}</p>
                        <p><span className="text-text-primary font-medium">MA90:</span> 90-day moving average of basket</p>
                        <p><span className="text-text-primary font-medium">Trend:</span> Compare recent 20-day avg vs prior 20-day avg (±2%)</p>
                        <div className="bg-background-secondary rounded p-2 mt-2">
                          <p className="text-accent-blue">• Price &gt; MA90 AND rising → <span className="text-sentiment-bullish">TAILWIND</span></p>
                          <p className="text-accent-blue">• Price &lt; MA90 AND falling → <span className="text-sentiment-bearish">HEADWIND</span></p>
                          <p className="text-accent-blue">• Otherwise → <span className="text-gray-400">NEUTRAL</span></p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
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
