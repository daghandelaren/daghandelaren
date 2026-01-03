'use client';

import { useState, useEffect } from 'react';
import CurrencyScoreCard from './CurrencyScoreCard';
import PairBiasTable from './PairBiasTable';
import MacroChat from './MacroChat';

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

interface PairBias {
  pair: string;
  base: string;
  quote: string;
  score: number;
  rating: 'Bullish' | 'Neutral' | 'Bearish';
}

interface Settings {
  riskRegime: string;
  riskSentimentJustification: string | null;
  bullishThreshold: number;
  bearishThreshold: number;
}

export default function FundamentalDashboard() {
  const [currencies, setCurrencies] = useState<CurrencyScore[]>([]);
  const [pairBiases, setPairBiases] = useState<PairBias[]>([]);
  const [settings, setSettings] = useState<Settings>({
    riskRegime: 'Neutral',
    riskSentimentJustification: null,
    bullishThreshold: 3,
    bearishThreshold: -3,
  });
  const [aiConfigured, setAiConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Modal state
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyScore | null>(null);
  const [showRiskModal, setShowRiskModal] = useState(false);

  // Fetch data
  const fetchData = async () => {
    try {
      const res = await fetch('/api/fundamental');
      const data = await res.json();
      setCurrencies(data.currencies || []);
      setPairBiases(data.pairBiases || []);
      setSettings(data.settings || settings);
      setAiConfigured(data.aiConfigured || false);

      // Get most recent update time
      if (data.currencies?.length > 0) {
        const latest = data.currencies.reduce((max: string, c: CurrencyScore) =>
          new Date(c.lastUpdated) > new Date(max) ? c.lastUpdated : max,
          data.currencies[0].lastUpdated
        );
        setLastUpdated(new Date(latest));
      }
    } catch (error) {
      console.error('Failed to fetch fundamental data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-surface-secondary rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-48 bg-surface-secondary rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-surface-secondary rounded-lg" />
          <div className="h-96 bg-surface-secondary rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Fundamental Analysis</h2>
          {lastUpdated && (
            <p className="text-sm text-text-muted">
              Last updated: {lastUpdated.toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span>Risk Regime:</span>
          <button
            onClick={() => setShowRiskModal(true)}
            className={`px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${
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

      {/* Currency Score Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
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

      {/* Bottom Section: Pairs + Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PairBiasTable pairs={pairBiases} />
        <MacroChat aiConfigured={aiConfigured} />
      </div>

      {/* Currency Justification Modal */}
      {selectedCurrency && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCurrency(null)}
        >
          <div
            className="bg-surface-primary border border-border-primary rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-surface-primary border-b border-border-primary p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-text-primary">
                  {selectedCurrency.currency}
                </h3>
                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                  selectedCurrency.rating === 'Bullish' ? 'bg-sentiment-bullish/15 text-sentiment-bullish border border-sentiment-bullish/30' :
                  selectedCurrency.rating === 'Bearish' ? 'bg-sentiment-bearish/15 text-sentiment-bearish border border-sentiment-bearish/30' :
                  'bg-gray-500/15 text-gray-400 border border-gray-500/30'
                }`}>
                  {selectedCurrency.rating}
                </span>
                <span className={`text-lg font-mono font-bold ${
                  selectedCurrency.totalScore > 0 ? 'text-sentiment-bullish' :
                  selectedCurrency.totalScore < 0 ? 'text-sentiment-bearish' :
                  'text-gray-400'
                }`}>
                  {selectedCurrency.totalScore > 0 ? '+' : ''}{selectedCurrency.totalScore}
                </span>
              </div>
              <button
                onClick={() => setSelectedCurrency(null)}
                className="text-text-muted hover:text-text-primary p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Yield Spread - Primary Indicator */}
              <div className={`rounded-lg p-4 border ${
                selectedCurrency.rateDifferential === 'Up' ? 'bg-sentiment-bullish/10 border-sentiment-bullish/20' :
                selectedCurrency.rateDifferential === 'Down' ? 'bg-sentiment-bearish/10 border-sentiment-bearish/20' :
                'bg-gray-500/10 border-gray-500/20'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-text-primary">{INDICATOR_EXPLANATIONS.rateDiff.title}</span>
                  <span className={`text-lg font-bold ${
                    selectedCurrency.rateDifferential === 'Up' ? 'text-sentiment-bullish' :
                    selectedCurrency.rateDifferential === 'Down' ? 'text-sentiment-bearish' :
                    'text-gray-400'
                  }`}>
                    {selectedCurrency.rateDifferential}
                  </span>
                </div>
                <p className="text-xs text-text-muted mb-2">{INDICATOR_EXPLANATIONS.rateDiff.description}</p>
                <p className="text-[10px] text-accent-blue">{INDICATOR_EXPLANATIONS.rateDiff.scoring}</p>
              </div>

              {/* Central Bank Tone */}
              <div className="rounded-lg p-3 bg-surface-secondary/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-text-primary">{INDICATOR_EXPLANATIONS.centralBank.title}</span>
                  <span className={`text-sm font-semibold ${
                    selectedCurrency.centralBankTone === 'Hawkish' ? 'text-sentiment-bullish' :
                    selectedCurrency.centralBankTone === 'Dovish' ? 'text-sentiment-bearish' :
                    'text-gray-400'
                  }`}>
                    {selectedCurrency.centralBankTone}
                  </span>
                </div>
                <p className="text-xs text-text-muted mb-1">{INDICATOR_EXPLANATIONS.centralBank.description}</p>
                <p className="text-[10px] text-accent-blue">{INDICATOR_EXPLANATIONS.centralBank.scoring}</p>
              </div>

              {/* Commodity Tailwind - only for commodity currencies */}
              {COMMODITY_CURRENCIES.includes(selectedCurrency.currency) && (
                <div className="rounded-lg p-3 bg-surface-secondary/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary">{INDICATOR_EXPLANATIONS.commodity.title}</span>
                    <span className={`text-sm font-semibold ${
                      selectedCurrency.commodityTailwind === 'Yes' ? 'text-sentiment-bullish' :
                      selectedCurrency.commodityTailwind === 'No' ? 'text-sentiment-bearish' :
                      'text-gray-400'
                    }`}>
                      {selectedCurrency.commodityTailwind === 'Yes' ? 'Tailwind' :
                       selectedCurrency.commodityTailwind === 'No' ? 'Headwind' : 'Neutral'}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mb-1">{INDICATOR_EXPLANATIONS.commodity.description}</p>
                  <p className="text-[10px] text-accent-blue">{INDICATOR_EXPLANATIONS.commodity.scoring}</p>
                </div>
              )}

              {/* Economic Data Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* CPI */}
                <div className="rounded-lg p-3 bg-surface-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-text-muted uppercase">Core CPI</span>
                    <span className={`text-xs font-semibold ${
                      selectedCurrency.inflationTrend === 'Down' ? 'text-sentiment-bullish' :
                      selectedCurrency.inflationTrend === 'Up' ? 'text-sentiment-bearish' :
                      'text-gray-400'
                    }`}>
                      {selectedCurrency.inflationTrend}
                    </span>
                  </div>
                  {selectedCurrency.cpiActual !== null && (
                    <div className="text-sm font-mono text-text-primary mb-2">
                      {selectedCurrency.cpiActual?.toFixed(1)}%
                      {selectedCurrency.cpiPrevious !== null && (
                        <span className="text-text-muted text-xs ml-1">← {selectedCurrency.cpiPrevious?.toFixed(1)}%</span>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-text-muted">{INDICATOR_EXPLANATIONS.inflation.description}</p>
                </div>

                {/* PMI */}
                <div className="rounded-lg p-3 bg-surface-secondary/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-text-muted uppercase">Services PMI</span>
                    <span className={`text-xs font-semibold ${
                      selectedCurrency.pmiSignal === 'Up' ? 'text-sentiment-bullish' :
                      selectedCurrency.pmiSignal === 'Down' ? 'text-sentiment-bearish' :
                      'text-gray-400'
                    }`}>
                      {selectedCurrency.pmiSignal}
                    </span>
                  </div>
                  {selectedCurrency.pmiActual !== null && (
                    <div className="text-sm font-mono text-text-primary mb-2">
                      {selectedCurrency.pmiActual?.toFixed(1)}
                      {selectedCurrency.pmiPrevious !== null && (
                        <span className="text-text-muted text-xs ml-1">← {selectedCurrency.pmiPrevious?.toFixed(1)}</span>
                      )}
                      <span className={`text-[10px] ml-2 ${(selectedCurrency.pmiActual ?? 0) >= 50 ? 'text-sentiment-bullish' : 'text-sentiment-bearish'}`}>
                        {(selectedCurrency.pmiActual ?? 0) >= 50 ? 'Expansion' : 'Contraction'}
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-text-muted">{INDICATOR_EXPLANATIONS.pmi.description}</p>
                </div>
              </div>

              {/* AI Justification */}
              {selectedCurrency.aiJustification && (
                <div className="border-t border-border-primary pt-4">
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">AI Analysis</p>
                  <p className="text-sm text-text-secondary italic leading-relaxed">
                    {selectedCurrency.aiJustification}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Risk Sentiment Justification Modal */}
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
    </div>
  );
}
