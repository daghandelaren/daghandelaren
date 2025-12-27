import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeDukascopySymbol,
  parseDukascopyData,
  parseDukascopyNetworkResponse,
  parseDukascopyHtml,
  parseSWFXIndex,
  getAssetClass,
} from '../dukascopy.parser';

// Load fixtures
const fixturesDir = path.join(__dirname, 'fixtures');

describe('Dukascopy Parser', () => {
  describe('normalizeDukascopySymbol', () => {
    it('should normalize EUR_USD to EUR/USD', () => {
      expect(normalizeDukascopySymbol('EUR_USD')).toBe('EUR/USD');
    });

    it('should normalize EURUSD to EUR/USD', () => {
      expect(normalizeDukascopySymbol('EURUSD')).toBe('EUR/USD');
    });

    it('should normalize EUR/USD to EUR/USD (passthrough)', () => {
      expect(normalizeDukascopySymbol('EUR/USD')).toBe('EUR/USD');
    });

    it('should normalize eur_usd to EUR/USD (case insensitive)', () => {
      expect(normalizeDukascopySymbol('eur_usd')).toBe('EUR/USD');
    });

    it('should normalize GBP-USD to GBP/USD', () => {
      expect(normalizeDukascopySymbol('GBP-USD')).toBe('GBP/USD');
    });

    it('should handle all major pairs', () => {
      const pairs = [
        ['USD_JPY', 'USD/JPY'],
        ['GBPJPY', 'GBP/JPY'],
        ['AUD_CAD', 'AUD/CAD'],
        ['NZDUSD', 'NZD/USD'],
        ['EUR_CHF', 'EUR/CHF'],
        ['CADJPY', 'CAD/JPY'],
        ['CHFJPY', 'CHF/JPY'],
      ];

      for (const [input, expected] of pairs) {
        expect(normalizeDukascopySymbol(input)).toBe(expected);
      }
    });

    it('should handle commodities', () => {
      expect(normalizeDukascopySymbol('XAU_USD')).toBe('XAU/USD');
      expect(normalizeDukascopySymbol('XAUUSD')).toBe('XAU/USD');
      expect(normalizeDukascopySymbol('XAG_USD')).toBe('XAG/USD');
      expect(normalizeDukascopySymbol('GOLD')).toBe('XAU/USD');
      expect(normalizeDukascopySymbol('SILVER')).toBe('XAG/USD');
    });

    it('should handle indices', () => {
      expect(normalizeDukascopySymbol('SPX500')).toBe('SPX500');
      expect(normalizeDukascopySymbol('US30')).toBe('US30');
      expect(normalizeDukascopySymbol('NAS100')).toBe('NAS100');
    });
  });

  describe('getAssetClass', () => {
    it('should identify forex pairs as fx', () => {
      expect(getAssetClass('EUR/USD')).toBe('fx');
      expect(getAssetClass('GBPJPY')).toBe('fx');
      expect(getAssetClass('AUD/CAD')).toBe('fx');
    });

    it('should identify commodities', () => {
      expect(getAssetClass('XAU/USD')).toBe('commodity');
      expect(getAssetClass('XAG_USD')).toBe('commodity');
      expect(getAssetClass('GOLD')).toBe('commodity');
      expect(getAssetClass('SILVER')).toBe('commodity');
    });

    it('should identify indices', () => {
      expect(getAssetClass('SPX500')).toBe('index');
      expect(getAssetClass('NAS100')).toBe('index');
      expect(getAssetClass('US30')).toBe('index');
      expect(getAssetClass('DE30')).toBe('index');
    });
  });

  describe('parseDukascopyNetworkResponse', () => {
    it('should parse network response fixture', () => {
      const fixtureContent = fs.readFileSync(
        path.join(fixturesDir, 'dukascopy-network-response.json'),
        'utf-8'
      );

      const result = parseDukascopyNetworkResponse(fixtureContent);

      expect(result.length).toBe(7);

      // Check EUR/USD
      const eurUsd = result.find((r) => r.symbol === 'EUR/USD');
      expect(eurUsd).toBeDefined();
      expect(eurUsd?.longPercent).toBe(42.5);
      expect(eurUsd?.shortPercent).toBe(57.5);

      // Check GBP/USD (longPercent format)
      const gbpUsd = result.find((r) => r.symbol === 'GBP/USD');
      expect(gbpUsd).toBeDefined();
      expect(gbpUsd?.longPercent).toBe(38);

      // Check USD/JPY (buy/sell format)
      const usdJpy = result.find((r) => r.symbol === 'USD/JPY');
      expect(usdJpy).toBeDefined();
      expect(usdJpy?.longPercent).toBe(65.3);

      // Check AUD/USD (bullish/bearish format)
      const audUsd = result.find((r) => r.symbol === 'AUD/USD');
      expect(audUsd).toBeDefined();
      expect(audUsd?.longPercent).toBe(52);

      // Check XAU/USD (commodity)
      const gold = result.find((r) => r.symbol === 'XAU/USD');
      expect(gold).toBeDefined();
      expect(gold?.longPercent).toBe(70.5);

      // Check EUR/GBP (SWFX index format: +15 means 57.5% long)
      const eurGbp = result.find((r) => r.symbol === 'EUR/GBP');
      expect(eurGbp).toBeDefined();
      expect(eurGbp?.longPercent).toBe(57.5);
      expect(eurGbp?.shortPercent).toBe(42.5);

      // Check GBP/JPY (ratio format 0.45 -> 45%)
      const gbpJpy = result.find((r) => r.symbol === 'GBP/JPY');
      expect(gbpJpy).toBeDefined();
      expect(gbpJpy?.longPercent).toBe(45);
      expect(gbpJpy?.shortPercent).toBe(55);
    });

    it('should handle various response structures', () => {
      // Array format
      const arrayResponse = JSON.stringify([
        { instrument: 'EUR_USD', longPercent: 40, shortPercent: 60 },
      ]);
      expect(parseDukascopyNetworkResponse(arrayResponse).length).toBe(1);

      // Nested data format
      const nestedResponse = JSON.stringify({
        data: {
          positions: [{ symbol: 'GBP_USD', long: 55, short: 45 }],
        },
      });
      expect(parseDukascopyNetworkResponse(nestedResponse).length).toBe(1);

      // Different field names
      const altFieldsResponse = JSON.stringify({
        sentiments: [{ pair: 'USD_JPY', buy: 70, sell: 30 }],
      });
      expect(parseDukascopyNetworkResponse(altFieldsResponse).length).toBe(1);
    });

    it('should handle JSONP responses', () => {
      const jsonpResponse = 'callback([{"symbol":"EUR/USD","long":40,"short":60}])';
      const result = parseDukascopyNetworkResponse(jsonpResponse);
      expect(result.length).toBe(1);
      expect(result[0].symbol).toBe('EUR/USD');
    });

    it('should return empty array for invalid JSON', () => {
      expect(parseDukascopyNetworkResponse('invalid json')).toEqual([]);
      expect(parseDukascopyNetworkResponse('{}')).toEqual([]);
    });
  });

  describe('parseDukascopyHtml', () => {
    it('should parse HTML fixture', () => {
      const fixtureContent = fs.readFileSync(
        path.join(fixturesDir, 'dukascopy-html-sample.html'),
        'utf-8'
      );

      const result = parseDukascopyHtml(fixtureContent);

      expect(result.length).toBeGreaterThanOrEqual(3);

      // Check table format
      const eurUsd = result.find((r) => r.symbol === 'EUR/USD');
      expect(eurUsd).toBeDefined();
      expect(eurUsd?.longPercent).toBe(42.5);
      expect(eurUsd?.shortPercent).toBe(57.5);
    });

    it('should parse simple HTML with percentages', () => {
      const html = '<div>EUR/USD 42.5% 57.5%</div><div>GBP/USD 38.0% 62.0%</div>';
      const result = parseDukascopyHtml(html);

      expect(result.length).toBeGreaterThanOrEqual(1);
      const eurUsd = result.find((r) => r.symbol === 'EUR/USD');
      expect(eurUsd).toBeDefined();
      expect(eurUsd?.longPercent).toBe(42.5);
      expect(eurUsd?.shortPercent).toBe(57.5);
    });

    it('should parse compact format without spaces', () => {
      const html = 'EUR/USD42%58%GBP/USD38%62%';
      const result = parseDukascopyHtml(html);

      expect(result.length).toBe(2);

      const eurUsd = result.find((r) => r.symbol === 'EUR/USD');
      expect(eurUsd).toBeDefined();
      expect(eurUsd?.longPercent).toBe(42);
      expect(eurUsd?.shortPercent).toBe(58);
    });
  });

  describe('parseDukascopyData', () => {
    it('should parse raw DOM data', () => {
      const rawData = [
        { symbol: 'EUR_USD', long: 35, short: 65 },
        { symbol: 'GBP/USD', long: 42, short: 58 },
      ];

      const result = parseDukascopyData(rawData);

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

      const result = parseDukascopyData(rawData);

      expect(result.length).toBe(1);
      expect(result[0].symbol).toBe('EUR/USD');
    });

    it('should deduplicate symbols', () => {
      const rawData = [
        { symbol: 'EUR_USD', long: 35, short: 65 },
        { symbol: 'EURUSD', long: 40, short: 60 }, // Duplicate after normalization
      ];

      const result = parseDukascopyData(rawData);

      expect(result.length).toBe(1);
    });

    it('should fallback to HTML parsing when raw data is empty', () => {
      const htmlContent = '<div>USD/JPY 68.2% 31.8%</div>';
      const result = parseDukascopyData([], htmlContent);

      expect(result.length).toBe(1);
      expect(result[0].symbol).toBe('USD/JPY');
    });
  });

  describe('parseSWFXIndex', () => {
    it('should convert SWFX index values to percentages', () => {
      const data = [
        { symbol: 'EUR/USD', index: 20 },  // +20 -> 60% long, 40% short
        { symbol: 'GBP/USD', index: -30 }, // -30 -> 35% long, 65% short
        { symbol: 'USD/JPY', index: 0 },   // 0 -> 50% long, 50% short
      ];

      const result = parseSWFXIndex(data);

      expect(result.length).toBe(3);

      expect(result[0].longPercent).toBe(60);
      expect(result[0].shortPercent).toBe(40);

      expect(result[1].longPercent).toBe(35);
      expect(result[1].shortPercent).toBe(65);

      expect(result[2].longPercent).toBe(50);
      expect(result[2].shortPercent).toBe(50);
    });

    it('should handle extreme values', () => {
      const data = [
        { symbol: 'EUR/USD', index: 100 },  // +100 -> 100% long, 0% short
        { symbol: 'GBP/USD', index: -100 }, // -100 -> 0% long, 100% short
      ];

      const result = parseSWFXIndex(data);

      expect(result[0].longPercent).toBe(100);
      expect(result[0].shortPercent).toBe(0);

      expect(result[1].longPercent).toBe(0);
      expect(result[1].shortPercent).toBe(100);
    });
  });

  describe('Symbol mapping edge cases', () => {
    it('should handle EUR/USD -> EURUSD format (output contract)', () => {
      const symbol = normalizeDukascopySymbol('EUR_USD');
      expect(symbol).toBe('EUR/USD');

      // For API output, we strip the slash
      const apiSymbol = symbol!.replace('/', '');
      expect(apiSymbol).toBe('EURUSD');
    });

    it('should normalize all 28 major forex pairs', () => {
      const pairs = [
        'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
        'EURJPY', 'GBPJPY', 'EURGBP', 'EURAUD', 'EURCAD', 'EURCHF', 'EURNZD',
        'GBPAUD', 'GBPCAD', 'GBPCHF', 'GBPNZD', 'AUDJPY', 'AUDCAD', 'AUDCHF',
        'AUDNZD', 'NZDJPY', 'NZDCAD', 'NZDCHF', 'CADJPY', 'CADCHF', 'CHFJPY',
      ];

      for (const pair of pairs) {
        const normalized = normalizeDukascopySymbol(pair);
        expect(normalized).not.toBeNull();
        expect(normalized).toContain('/');
        expect(normalized!.length).toBe(7); // XXX/YYY format
      }
    });
  });
});
