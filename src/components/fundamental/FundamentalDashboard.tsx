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
  creditConditions: string;
  commodityTailwind: string;
  aiJustification: string | null;
  manualOverride: boolean;
  lastUpdated: string;
  updatedBy: string | null;
}

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
            creditConditions={currency.creditConditions}
            commodityTailwind={currency.commodityTailwind}
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
            className="bg-surface-primary border border-border-primary rounded-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-text-primary">
                {selectedCurrency.currency} Analysis
              </h3>
              <button
                onClick={() => setSelectedCurrency(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Score</span>
                <span className={`font-bold ${
                  selectedCurrency.totalScore > 0 ? 'text-sentiment-bullish' :
                  selectedCurrency.totalScore < 0 ? 'text-sentiment-bearish' :
                  'text-gray-400'
                }`}>
                  {selectedCurrency.totalScore > 0 ? '+' : ''}{selectedCurrency.totalScore}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Rating</span>
                <span className={`font-semibold ${
                  selectedCurrency.rating === 'Bullish' ? 'text-sentiment-bullish' :
                  selectedCurrency.rating === 'Bearish' ? 'text-sentiment-bearish' :
                  'text-gray-400'
                }`}>
                  {selectedCurrency.rating}
                </span>
              </div>
              <hr className="border-border-primary" />
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">AI Justification</p>
                <p className="text-sm text-text-muted">
                  {selectedCurrency.aiJustification || 'No AI justification available.'}
                </p>
              </div>
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
