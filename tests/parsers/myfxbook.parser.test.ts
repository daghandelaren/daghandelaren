import { describe, it, expect } from 'vitest';
import { parseMyfxbookData, parseMyfxbookRaw } from '../../src/scrapers/parsers/myfxbook.parser';
import type { MyfxbookSymbol } from '../../src/types';

describe('Myfxbook Parser', () => {
  describe('parseMyfxbookData', () => {
    it('should parse valid symbol data', () => {
      const input: MyfxbookSymbol[] = [
        { name: 'EURUSD', longPercentage: 65.5, shortPercentage: 34.5 },
        { name: 'GBPUSD', longPercentage: 45.0, shortPercentage: 55.0 },
      ];

      const result = parseMyfxbookData(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        symbol: 'EUR/USD',
        longPercent: 65.5,
        shortPercent: 34.5,
      });
      expect(result[1]).toEqual({
        symbol: 'GBP/USD',
        longPercent: 45.0,
        shortPercent: 55.0,
      });
    });

    it('should normalize symbol formats', () => {
      const input: MyfxbookSymbol[] = [
        { name: 'EUR_USD', longPercentage: 50, shortPercentage: 50 },
        { name: 'GBP/JPY', longPercentage: 60, shortPercentage: 40 },
        { name: 'AUDUSD', longPercentage: 55, shortPercentage: 45 },
      ];

      const result = parseMyfxbookData(input);

      expect(result[0].symbol).toBe('EUR/USD');
      expect(result[1].symbol).toBe('GBP/JPY');
      expect(result[2].symbol).toBe('AUD/USD');
    });

    it('should filter out invalid percentages', () => {
      const input: MyfxbookSymbol[] = [
        { name: 'EURUSD', longPercentage: 65, shortPercentage: 35 },
        { name: 'GBPUSD', longPercentage: -10, shortPercentage: 110 }, // Invalid
        { name: 'USDJPY', longPercentage: 150, shortPercentage: -50 }, // Invalid
        { name: 'AUDUSD', longPercentage: NaN, shortPercentage: 50 }, // Invalid
      ];

      const result = parseMyfxbookData(input);

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toBe('EUR/USD');
    });

    it('should handle empty input', () => {
      const result = parseMyfxbookData([]);
      expect(result).toHaveLength(0);
    });

    it('should handle edge case percentages', () => {
      const input: MyfxbookSymbol[] = [
        { name: 'EURUSD', longPercentage: 0, shortPercentage: 100 },
        { name: 'GBPUSD', longPercentage: 100, shortPercentage: 0 },
        { name: 'USDJPY', longPercentage: 50, shortPercentage: 50 },
      ];

      const result = parseMyfxbookData(input);

      expect(result).toHaveLength(3);
      expect(result[0].longPercent).toBe(0);
      expect(result[0].shortPercent).toBe(100);
      expect(result[1].longPercent).toBe(100);
      expect(result[1].shortPercent).toBe(0);
    });
  });

  describe('parseMyfxbookRaw', () => {
    it('should parse valid JSON response', () => {
      const json = JSON.stringify({
        symbols: [
          { name: 'EURUSD', longPercentage: 60, shortPercentage: 40 },
          { name: 'GBPUSD', longPercentage: 55, shortPercentage: 45 },
        ],
      });

      const result = parseMyfxbookRaw(json);

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('EUR/USD');
    });

    it('should return empty array for invalid JSON', () => {
      const result = parseMyfxbookRaw('invalid json');
      expect(result).toHaveLength(0);
    });

    it('should return empty array for missing symbols array', () => {
      const result = parseMyfxbookRaw('{"data": []}');
      expect(result).toHaveLength(0);
    });
  });
});
