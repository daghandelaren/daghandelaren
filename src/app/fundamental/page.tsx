'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import MegaMenu from '@/components/layout/MegaMenu';
import CurrencyScoreCard from '@/components/fundamental/CurrencyScoreCard';

interface CurrencyScore {
  currency: string;
  totalScore: number;
  rating: string;
  inflationTrend: string;
  pmiSignal: string;
  centralBankTone: string;
  rateDifferential: string;
  commodityTailwind: string;
  cpiActual: number | null;
  cpiPrevious: number | null;
  pmiActual: number | null;
  pmiPrevious: number | null;
  aiJustification: string | null;
  manualOverride: boolean;
  lastUpdated: string;
  updatedBy: string | null;
}

interface Settings {
  riskRegime: string;
  riskSentimentJustification: string | null;
  bullishThreshold: number;
  bearishThreshold: number;
}

// Indicator explanations for the modal
const INDICATOR_EXPLANATIONS = {
  rateDiff: {
    title: '2Y Yield Spread vs USD',
    description: 'Compares the 20-day and 60-day moving averages of the yield differential between this currency and USD. When the spread improves (MA20 crosses above MA60), it signals rate expectations are becoming more favorable.',
    scoring: 'Up (improving) = Bullish (+1), Down (deteriorating) = Bearish (-1), Flat = Neutral (0)',
  },
  centralBank: {
    title: 'Central Bank Tone',
    description: 'AI-assessed monetary policy stance from recent central bank communications, speeches, and meeting minutes.',
    scoring: 'Hawkish = Bullish (+1), Dovish = Bearish (-1), Neutral (0)',
  },
  commodity: {
    title: 'Commodity Tailwind',
    description: 'For commodity currencies only. AUD: Iron Ore + Copper basket. CAD: WTI Oil. NZD: Dairy. Signal based on price relative to 90-day MA and trend direction.',
    scoring: 'Yes (tailwind) = Bullish (+1), No (headwind) = Bearish (-1), Neutral (0)',
  },
  inflation: {
    title: 'Core CPI Trend',
    description: 'Compares the latest Core CPI reading to the previous release. Falling inflation (disinflation) allows central banks to ease policy.',
    scoring: 'Down = Bullish (+1), Up = Bearish (-1), Flat = Neutral (0)',
  },
  pmi: {
    title: 'Services PMI',
    description: 'Purchasing Managers Index for the services sector. Above 50 indicates expansion, below 50 indicates contraction.',
    scoring: 'Rising = Bullish (+1), Falling = Bearish (-1), Flat = Neutral (0)',
  },
};

const COMMODITY_CURRENCIES = ['AUD', 'CAD', 'NZD'];

export default function FundamentalPage() {
  const { data: session } = useSession();
  const [currencies, setCurrencies] = useState<CurrencyScore[]>([]);
  const [settings, setSettings] = useState<Settings>({
    riskRegime: 'Neutral',
    riskSentimentJustification: null,
    bullishThreshold: 3,
    bearishThreshold: -3,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyScore | null>(null);
  const [showRiskModal, setShowRiskModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/fundamental');
        const data = await res.json();
        setCurrencies(data.currencies || []);
        setSettings(data.settings || settings);
      } catch (error) {
        console.error('Failed to fetch fundamental data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const isAdmin = session?.user?.role === 'ADMIN';

  if (loading) {
    return (
      <div className="min-h-screen bg-background-primary">
        <MegaMenu userEmail={session?.user?.email || ''} isAdmin={isAdmin} />
        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
          <div className="space-y-6 animate-pulse">
            <div className="h-12 bg-surface-secondary rounded-lg w-64" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-72 bg-surface-secondary rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      <MegaMenu userEmail={session?.user?.email || ''} isAdmin={isAdmin} />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>Risk Regime:</span>
            <button
              onClick={() => setShowRiskModal(true)}
              className={`px-3 py-1.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity font-medium ${
                settings.riskRegime === 'Risk-on' ? 'bg-green-500/20 text-green-400' :
                settings.riskRegime === 'Risk-off' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}
              title="Click to see AI reasoning"
            >
              {settings.riskRegime}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {currencies.map((currency) => (
            <CurrencyScoreCard
              key={currency.currency}
              currency={currency.currency}
              totalScore={currency.totalScore}
              rating={currency.rating}
              inflationTrend={currency.inflationTrend}
              pmiSignal={currency.pmiSignal}
              centralBankTone={currency.centralBankTone}
              rateDifferential={currency.rateDifferential}
              commodityTailwind={currency.commodityTailwind}
              cpiActual={currency.cpiActual}
              cpiPrevious={currency.cpiPrevious}
              pmiActual={currency.pmiActual}
              pmiPrevious={currency.pmiPrevious}
              aiJustification={currency.aiJustification}
              manualOverride={currency.manualOverride}
              onClick={() => setSelectedCurrency(currency)}
            />
          ))}
        </div>

        {currencies.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-text-muted">No fundamental data yet. Run analysis from the Admin panel.</p>
          </div>
        )}

        {selectedCurrency && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-[fadeIn_0.2s_ease-out]"
            onClick={() => setSelectedCurrency(null)}
          >
            <div
              className="relative bg-surface-primary border border-border-primary/50 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-2xl shadow-black/50 animate-[slideUp_0.3s_ease-out]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative gradient glow */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none ${
                selectedCurrency.rating === 'Bullish' ? 'bg-green-500' :
                selectedCurrency.rating === 'Bearish' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />

              {/* Header */}
              <div className="sticky top-0 bg-surface-primary/95 backdrop-blur-md border-b border-border-primary/50 p-5 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                  <h3 className="text-2xl font-bold text-text-primary tracking-tight">
                    {selectedCurrency.currency}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${
                      selectedCurrency.rating === 'Bullish' ? 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30' :
                      selectedCurrency.rating === 'Bearish' ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30' :
                      'bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30'
                    }`}>
                      {selectedCurrency.rating}
                    </span>
                    <span className={`text-xl font-mono font-bold ${
                      selectedCurrency.totalScore > 0 ? 'text-green-400' :
                      selectedCurrency.totalScore < 0 ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {selectedCurrency.totalScore > 0 ? '+' : ''}{selectedCurrency.totalScore}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCurrency(null)}
                  className="text-text-muted hover:text-text-primary p-2 hover:bg-surface-secondary rounded-lg transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-80px)]">
                {/* Yield Spread - Primary Indicator */}
                <div
                  className={`relative rounded-xl p-5 border overflow-hidden transition-all duration-300 hover:scale-[1.01] ${
                    selectedCurrency.rateDifferential === 'Up' ? 'bg-green-500/10 border-green-500/30' :
                    selectedCurrency.rateDifferential === 'Down' ? 'bg-red-500/10 border-red-500/30' :
                    'bg-gray-500/10 border-gray-500/30'
                  }`}
                  style={{ animationDelay: '0.05s' }}
                >
                  {/* Subtle pattern overlay */}
                  <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
                    backgroundSize: '16px 16px'
                  }} />

                  <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">Primary Signal</span>
                        <h4 className="text-sm font-semibold text-text-primary mt-1">{INDICATOR_EXPLANATIONS.rateDiff.title}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold tracking-tight ${
                          selectedCurrency.rateDifferential === 'Up' ? 'text-green-400' :
                          selectedCurrency.rateDifferential === 'Down' ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {selectedCurrency.rateDifferential}
                        </span>
                        <span className={`text-lg ${
                          selectedCurrency.rateDifferential === 'Up' ? 'text-green-400' :
                          selectedCurrency.rateDifferential === 'Down' ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {selectedCurrency.rateDifferential === 'Up' ? '▲' :
                           selectedCurrency.rateDifferential === 'Down' ? '▼' : '●'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mb-3">{INDICATOR_EXPLANATIONS.rateDiff.description}</p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-surface-secondary/50 text-text-muted">MA20 vs MA60</span>
                      <span className="text-accent-blue">{INDICATOR_EXPLANATIONS.rateDiff.scoring}</span>
                    </div>
                  </div>
                </div>

                {/* Central Bank Tone */}
                <div
                  className="rounded-xl p-4 bg-surface-secondary/40 border border-border-primary/30 hover:bg-surface-secondary/60 transition-all duration-300"
                  style={{ animationDelay: '0.1s' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-text-primary">{INDICATOR_EXPLANATIONS.centralBank.title}</span>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                      selectedCurrency.centralBankTone === 'Hawkish' ? 'bg-green-500/15 text-green-400' :
                      selectedCurrency.centralBankTone === 'Dovish' ? 'bg-red-500/15 text-red-400' :
                      'bg-gray-500/15 text-gray-400'
                    }`}>
                      {selectedCurrency.centralBankTone}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mb-2">{INDICATOR_EXPLANATIONS.centralBank.description}</p>
                  <p className="text-[10px] text-accent-blue">{INDICATOR_EXPLANATIONS.centralBank.scoring}</p>
                </div>

                {/* Commodity Tailwind - only for commodity currencies */}
                {COMMODITY_CURRENCIES.includes(selectedCurrency.currency) && (
                  <div
                    className="rounded-xl p-4 bg-surface-secondary/40 border border-border-primary/30 hover:bg-surface-secondary/60 transition-all duration-300"
                    style={{ animationDelay: '0.15s' }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-text-primary">{INDICATOR_EXPLANATIONS.commodity.title}</span>
                      <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                        selectedCurrency.commodityTailwind === 'Yes' ? 'bg-green-500/15 text-green-400' :
                        selectedCurrency.commodityTailwind === 'No' ? 'bg-red-500/15 text-red-400' :
                        'bg-gray-500/15 text-gray-400'
                      }`}>
                        {selectedCurrency.commodityTailwind === 'Yes' ? 'Tailwind' :
                         selectedCurrency.commodityTailwind === 'No' ? 'Headwind' : 'Neutral'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mb-2">{INDICATOR_EXPLANATIONS.commodity.description}</p>
                    <p className="text-[10px] text-accent-blue">{INDICATOR_EXPLANATIONS.commodity.scoring}</p>
                  </div>
                )}

                {/* Economic Data Row */}
                <div className="grid grid-cols-2 gap-3" style={{ animationDelay: '0.2s' }}>
                  {/* CPI */}
                  <div className="rounded-xl p-4 bg-surface-secondary/30 border border-border-primary/20 hover:bg-surface-secondary/50 transition-all duration-300">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Core CPI</span>
                      <span className={`text-xs font-bold ${
                        selectedCurrency.inflationTrend === 'Up' ? 'text-green-400' :
                        selectedCurrency.inflationTrend === 'Down' ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                        {selectedCurrency.inflationTrend}
                      </span>
                    </div>
                    {selectedCurrency.cpiActual !== null && (
                      <div className="text-lg font-mono font-semibold text-text-primary mb-2">
                        {selectedCurrency.cpiActual?.toFixed(1)}%
                        {selectedCurrency.cpiPrevious !== null && (
                          <span className="text-text-muted text-xs font-normal ml-2">← {selectedCurrency.cpiPrevious?.toFixed(1)}%</span>
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-text-muted leading-relaxed">{INDICATOR_EXPLANATIONS.inflation.description}</p>
                  </div>

                  {/* PMI */}
                  <div className="rounded-xl p-4 bg-surface-secondary/30 border border-border-primary/20 hover:bg-surface-secondary/50 transition-all duration-300">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Services PMI</span>
                      <span className={`text-xs font-bold ${
                        selectedCurrency.pmiSignal === 'Up' ? 'text-green-400' :
                        selectedCurrency.pmiSignal === 'Down' ? 'text-red-400' :
                        'text-gray-400'
                      }`}>
                        {selectedCurrency.pmiSignal}
                      </span>
                    </div>
                    {selectedCurrency.pmiActual !== null && (
                      <div className="mb-2">
                        <span className="text-lg font-mono font-semibold text-text-primary">
                          {selectedCurrency.pmiActual?.toFixed(1)}
                        </span>
                        {selectedCurrency.pmiPrevious !== null && (
                          <span className="text-text-muted text-xs ml-2">← {selectedCurrency.pmiPrevious?.toFixed(1)}</span>
                        )}
                        <span className={`text-[10px] ml-2 px-1.5 py-0.5 rounded ${
                          (selectedCurrency.pmiActual ?? 0) >= 50
                            ? 'bg-green-500/15 text-green-400'
                            : 'bg-red-500/15 text-red-400'
                        }`}>
                          {(selectedCurrency.pmiActual ?? 0) >= 50 ? 'Expansion' : 'Contraction'}
                        </span>
                      </div>
                    )}
                    <p className="text-[10px] text-text-muted leading-relaxed">{INDICATOR_EXPLANATIONS.pmi.description}</p>
                  </div>
                </div>

                {/* AI Justification */}
                {selectedCurrency.aiJustification && (
                  <div
                    className="relative rounded-xl p-4 bg-gradient-to-br from-surface-secondary/50 to-surface-secondary/20 border border-border-primary/30"
                    style={{ animationDelay: '0.25s' }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-4 bg-accent-blue rounded-full" />
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">AI Analysis</span>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {selectedCurrency.aiJustification}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <style jsx>{`
              @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes slideUp {
                from {
                  opacity: 0;
                  transform: translateY(20px) scale(0.98);
                }
                to {
                  opacity: 1;
                  transform: translateY(0) scale(1);
                }
              }
            `}</style>
          </div>
        )}

        {showRiskModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRiskModal(false)}
          >
            <div
              className="bg-surface-primary border border-border-primary rounded-lg max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-primary">
                  Risk Sentiment: {settings.riskRegime}
                </h3>
                <button
                  onClick={() => setShowRiskModal(false)}
                  className="text-text-muted hover:text-text-primary"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className={`inline-block px-3 py-1.5 rounded text-sm font-semibold mb-4 ${
                settings.riskRegime === 'Risk-on' ? 'bg-green-500/20 text-green-400' :
                settings.riskRegime === 'Risk-off' ? 'bg-red-500/20 text-red-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {settings.riskRegime}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">AI Justification</p>
                <p className="text-sm text-text-muted">
                  {settings.riskSentimentJustification || 'No AI justification available. Run AI analysis to get reasoning.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
