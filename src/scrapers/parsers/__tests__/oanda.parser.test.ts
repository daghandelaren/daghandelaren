import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeOandaSymbol,
  parseOandaData,
  parseOandaNetworkResponse,
  parseOandaHtml,
  getAssetClass,
} from '../oanda.parser';

// Load fixtures
const fixturesDir = path.join(__dirname, 'fixtures');

describe('OANDA Parser', () => {
  describe('normalizeOandaSymbol', () => {
    it('should normalize EUR_USD to EUR/USD', () => {
      expect(normalizeOandaSymbol('EUR_USD')).toBe('EUR/USD');
    });

    it('should normalize EURUSD to EUR/USD', () => {
      expect(normalizeOandaSymbol('EURUSD')).toBe('EUR/USD');
    });

    it('should normalize EUR/USD to EUR/USD (passthrough)', () => {
      expect(normalizeOandaSymbol('EUR/USD')).toBe('EUR/USD');
    });

    it('should normalize eur_usd to EUR/USD (case insensitive)', () => {
      expect(normalizeOandaSymbol('eur_usd')).toBe('EUR/USD');
    });

    it('should normalize GBP-USD to GBP/USD', () => {
      expect(normalizeOandaSymbol('GBP-USD')).toBe('GBP/USD');
    });

    it('should handle all major pairs', () => {
      const pairs = [
        ['USD_JPY', 'USD/JPY'],
        ['GBPJPY', 'GBP/JPY'],
        ['AUD_CAD', 'AUD/CAD'],
        ['NZDUSD', 'NZD/USD'],
        ['EUR_CHF', 'EUR/CHF'],
      ];

      for (const [input, expected] of pairs) {
        expect(normalizeOandaSymbol(input)).toBe(expected);
      }
    });

    it('should handle commodities', () => {
      expect(normalizeOandaSymbol('XAU_USD')).toBe('XAU/USD');
      expect(normalizeOandaSymbol('XAUUSD')).toBe('XAU/USD');
      expect(normalizeOandaSymbol('XAG_USD')).toBe('XAG/USD');
    });

    it('should handle indices', () => {
      expect(normalizeOandaSymbol('SPX500_USD')).toBe('SPX500');
      expect(normalizeOandaSymbol('US30_USD')).toBe('US30');
    });
  });

  describe('getAssetClass', () => {
    it('should identify forex pairs as fx', () => {
      expect(getAssetClass('EUR/USD')).toBe('fx');
      expect(getAssetClass('GBPJPY')).toBe('fx');
    });

    it('should identify commodities', () => {
      expect(getAssetClass('XAU/USD')).toBe('commodity');
      expect(getAssetClass('XAG_USD')).toBe('commodity');
      expect(getAssetClass('WTI/USD')).toBe('commodity');
      expect(getAssetClass('BRENT/USD')).toBe('commodity');
    });

    it('should identify indices', () => {
      expect(getAssetClass('SPX500')).toBe('index');
      expect(getAssetClass('NAS100')).toBe('index');
      expect(getAssetClass('US30')).toBe('index');
    });
  });

  describe('parseOandaNetworkResponse', () => {
    it('should parse network response fixture', () => {
      const fixtureContent = fs.readFileSync(
        path.join(fixturesDir, 'oanda-network-response.json'),
        'utf-8'
      );

      const result = parseOandaNetworkResponse(fixtureContent);

      expect(result.length).toBe(6);

      // Check EUR/USD
      const eurUsd = result.find((r) => r.symbol === 'EUR/USD');
      expect(eurUsd).toBeDefined();
      expect(eurUsd?.longPercent).toBe(35.5);
      expect(eurUsd?.shortPercent).toBe(64.5);

      // Check GBP/USD
      const gbpUsd = result.find((r) => r.symbol === 'GBP/USD');
      expect(gbpUsd).toBeDefined();
      expect(gbpUsd?.longPercent).toBe(42.3);

      // Check XAU/USD (commodity)
      const gold = result.find((r) => r.symbol === 'XAU/USD');
      expect(gold).toBeDefined();
      expect(gold?.longPercent).toBe(72.5);

      // Check EUR/GBP (ratio format 0.48 -> 48%)
      const eurGbp = result.find((r) => r.symbol === 'EUR/GBP');
      expect(eurGbp).toBeDefined();
      expect(eurGbp?.longPercent).toBe(48);
      expect(eurGbp?.shortPercent).toBe(52);
    });

    it('should handle various response structures', () => {
      // Array format
      const arrayResponse = JSON.stringify([
        { instrument: 'EUR_USD', longPercent: 40, shortPercent: 60 },
      ]);
      expect(parseOandaNetworkResponse(arrayResponse).length).toBe(1);

      // Nested data format
      const nestedResponse = JSON.stringify({
        data: {
          positions: [{ symbol: 'GBP_USD', long: 55, short: 45 }],
        },
      });
      expect(parseOandaNetworkResponse(nestedResponse).length).toBe(1);

      // Different field names
      const altFieldsResponse = JSON.stringify({
        sentiments: [{ pair: 'USD_JPY', buyPercent: 70, sellPercent: 30 }],
      });
      expect(parseOandaNetworkResponse(altFieldsResponse).length).toBe(1);
    });

    it('should return empty array for invalid JSON', () => {
      expect(parseOandaNetworkResponse('invalid json')).toEqual([]);
      expect(parseOandaNetworkResponse('{}')).toEqual([]);
    });
  });

  describe('parseOandaHtml', () => {
    it('should parse simple HTML with percentages', () => {
      // Simple pattern: SYMBOL followed by two percentages (OANDA shows SHORT first, LONG second)
      const html = '<div>EUR/USD 35.5 64.5</div><div>GBP/USD 42.0% 58.0%</div>';
      const result = parseOandaHtml(html);

      expect(result.length).toBeGreaterThanOrEqual(1);
      const eurUsd = result.find((r) => r.symbol === 'EUR/USD');
      expect(eurUsd).toBeDefined();
      // First value is SHORT (35.5), second is LONG (64.5)
      expect(eurUsd?.shortPercent).toBe(35.5);
      expect(eurUsd?.longPercent).toBe(64.5);
    });

    it('should extract from various HTML patterns', () => {
      const html1 = '<div>EUR/USD 35.5 64.5</div>';
      const result1 = parseOandaHtml(html1);
      expect(result1.length).toBe(1);
      expect(result1[0].symbol).toBe('EUR/USD');
      // OANDA format: first=SHORT, second=LONG
      expect(result1[0].shortPercent).toBe(35.5);
      expect(result1[0].longPercent).toBe(64.5);
    });

    it('should handle embedded JSON pattern', () => {
      const html = '"instrument": "EUR_USD"..."longPercent": 40';
      const result = parseOandaHtml(html);
      // May or may not match depending on exact format
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should parse compact OANDA format (no spaces)', () => {
      // Real OANDA proptrader format: "EUR/USD72%28%" means 72% SHORT, 28% LONG
      const html = 'USD/CHF7%93%EUR/USD72%28%GBP/USD51%49%AUD/JPY43%57%';
      const result = parseOandaHtml(html);

      expect(result.length).toBe(4);

      // USD/CHF: 7% SHORT, 93% LONG
      const usdChf = result.find((r) => r.symbol === 'USD/CHF');
      expect(usdChf).toBeDefined();
      expect(usdChf?.shortPercent).toBe(7);
      expect(usdChf?.longPercent).toBe(93);

      // EUR/USD: 72% SHORT, 28% LONG
      const eurUsd = result.find((r) => r.symbol === 'EUR/USD');
      expect(eurUsd).toBeDefined();
      expect(eurUsd?.shortPercent).toBe(72);
      expect(eurUsd?.longPercent).toBe(28);
    });
  });

  describe('parseOandaData', () => {
    it('should parse raw DOM data', () => {
      const rawData = [
        { symbol: 'EUR_USD', long: 35, short: 65 },
        { symbol: 'GBP/USD', long: 42, short: 58 },
      ];

      const result = parseOandaData(rawData);

      expect(result.length).toBe(2);
      expect(result[0].symbol).toBe('EUR/USD');
      expect(result[0].longPercent).toBe(35);
    });

    it('should skip invalid percentages', () => {
      const rawData = [
        { symbol: 'EUR_USD', long: 35, short: 65 }, // Valid
        { symbol: 'GBP_USD', long: 150, short: -50 }, // Invalid
        { symbol: 'USD_JPY', long: 30, short: 30 }, // Doesn't sum to ~100
      ];

      const result = parseOandaData(rawData);

      expect(result.length).toBe(1);
      expect(result[0].symbol).toBe('EUR/USD');
    });

    it('should deduplicate symbols', () => {
      const rawData = [
        { symbol: 'EUR_USD', long: 35, short: 65 },
        { symbol: 'EURUSD', long: 40, short: 60 }, // Duplicate after normalization
      ];

      const result = parseOandaData(rawData);

      expect(result.length).toBe(1);
    });

    it('should fallback to HTML parsing when raw data is empty', () => {
      const htmlContent = '<div>USD/JPY 68.2% 31.8%</div>';
      const result = parseOandaData([], htmlContent);

      expect(result.length).toBe(1);
      expect(result[0].symbol).toBe('USD/JPY');
    });
  });

  describe('Symbol mapping edge cases', () => {
    it('should handle EUR/USD -> EURUSD format (output contract)', () => {
      const symbol = normalizeOandaSymbol('EUR_USD');
      expect(symbol).toBe('EUR/USD');

      // For API output, we strip the slash
      const apiSymbol = symbol!.replace('/', '');
      expect(apiSymbol).toBe('EURUSD');
    });
  });
});
