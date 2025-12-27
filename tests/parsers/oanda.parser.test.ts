import { describe, it, expect } from 'vitest';
import { parseOandaData, parseOandaHtml, parseOandaJson } from '../../src/scrapers/parsers/oanda.parser';

describe('OANDA Parser', () => {
  describe('parseOandaData', () => {
    it('should parse valid raw data', () => {
      const input = [
        { symbol: 'EUR/USD', long: 65, short: 35 },
        { symbol: 'GBP/USD', long: 45, short: 55 },
      ];

      const result = parseOandaData(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        symbol: 'EUR/USD',
        longPercent: 65,
        shortPercent: 35,
      });
    });

    it('should normalize symbol formats', () => {
      const input = [
        { symbol: 'EURUSD', long: 50, short: 50 },
        { symbol: 'GBP_JPY', long: 60, short: 40 },
      ];

      const result = parseOandaData(input);

      expect(result[0].symbol).toBe('EUR/USD');
      expect(result[1].symbol).toBe('GBP/JPY');
    });

    it('should deduplicate symbols', () => {
      const input = [
        { symbol: 'EUR/USD', long: 65, short: 35 },
        { symbol: 'EURUSD', long: 60, short: 40 }, // Duplicate after normalization
        { symbol: 'EUR_USD', long: 55, short: 45 }, // Another duplicate
      ];

      const result = parseOandaData(input);

      expect(result).toHaveLength(1);
      expect(result[0].longPercent).toBe(65); // First occurrence kept
    });

    it('should filter invalid percentages', () => {
      const input = [
        { symbol: 'EUR/USD', long: 65, short: 35 },
        { symbol: 'GBP/USD', long: -5, short: 105 }, // Invalid
        { symbol: 'USD/JPY', long: 150, short: -50 }, // Invalid
      ];

      const result = parseOandaData(input);

      expect(result).toHaveLength(1);
    });

    it('should validate percentages sum to ~100', () => {
      const input = [
        { symbol: 'EUR/USD', long: 65, short: 35 }, // Valid: 100
        { symbol: 'GBP/USD', long: 60, short: 41 }, // Valid: 101 (within tolerance)
        { symbol: 'USD/JPY', long: 50, short: 20 }, // Invalid: 70
      ];

      const result = parseOandaData(input);

      expect(result).toHaveLength(2);
    });

    it('should handle empty input', () => {
      const result = parseOandaData([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('parseOandaHtml', () => {
    it('should extract data from HTML patterns', () => {
      const html = `
        <div class="row">EUR/USD 65% 35%</div>
        <div class="row">GBP/USD 55.5% 44.5%</div>
      `;

      const result = parseOandaHtml(html);

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('EUR/USD');
      expect(result[0].longPercent).toBe(65);
    });

    it('should handle various percentage formats', () => {
      const html = `
        <span>EURUSD 60 40</span>
        <span>GBPUSD 55.5 44.5</span>
      `;

      const result = parseOandaHtml(html);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array for no matches', () => {
      const html = '<div>No forex data here</div>';

      const result = parseOandaHtml(html);

      expect(result).toHaveLength(0);
    });
  });

  describe('parseOandaJson', () => {
    it('should parse array format', () => {
      const json = JSON.stringify([
        { symbol: 'EUR/USD', longPercent: 65, shortPercent: 35 },
        { symbol: 'GBP/USD', longPercent: 55, shortPercent: 45 },
      ]);

      const result = parseOandaJson(json);

      expect(result).toHaveLength(2);
      expect(result[0].symbol).toBe('EUR/USD');
    });

    it('should calculate shortPercent if missing', () => {
      const json = JSON.stringify([{ symbol: 'EUR/USD', longPercent: 65 }]);

      const result = parseOandaJson(json);

      expect(result[0].shortPercent).toBe(35);
    });

    it('should return empty array for invalid JSON', () => {
      const result = parseOandaJson('not json');
      expect(result).toHaveLength(0);
    });
  });
});
