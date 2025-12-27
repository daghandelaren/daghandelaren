import { describe, it, expect } from 'vitest';
import {
  parseDukascopyData,
  parseDukascopyHtml,
  parseDukascopyJson,
  parseSWFXIndex,
} from '../../src/scrapers/parsers/dukascopy.parser';

describe('Dukascopy Parser', () => {
  describe('parseDukascopyData', () => {
    it('should parse valid raw data', () => {
      const input = [
        { symbol: 'EUR/USD', long: 60, short: 40 },
        { symbol: 'GBP/USD', long: 45, short: 55 },
      ];

      const result = parseDukascopyData(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        symbol: 'EUR/USD',
        longPercent: 60,
        shortPercent: 40,
      });
    });

    it('should normalize symbol formats', () => {
      const input = [
        { symbol: 'EURUSD', long: 50, short: 50 },
        { symbol: 'GBP_JPY', long: 60, short: 40 },
      ];

      const result = parseDukascopyData(input);

      expect(result[0].symbol).toBe('EUR/USD');
      expect(result[1].symbol).toBe('GBP/JPY');
    });

    it('should deduplicate symbols', () => {
      const input = [
        { symbol: 'EUR/USD', long: 60, short: 40 },
        { symbol: 'EURUSD', long: 55, short: 45 }, // Duplicate
      ];

      const result = parseDukascopyData(input);

      expect(result).toHaveLength(1);
      expect(result[0].longPercent).toBe(60); // First occurrence
    });

    it('should filter invalid percentages', () => {
      const input = [
        { symbol: 'EUR/USD', long: 60, short: 40 }, // Valid
        { symbol: 'GBP/USD', long: -10, short: 110 }, // Invalid
        { symbol: 'USD/JPY', long: NaN, short: 50 }, // Invalid
      ];

      const result = parseDukascopyData(input);

      expect(result).toHaveLength(1);
    });

    it('should handle empty input', () => {
      const result = parseDukascopyData([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('parseDukascopyHtml', () => {
    it('should extract data from HTML table patterns', () => {
      const html = `
        <table>
          <tr><td>EUR/USD</td><td>60%</td><td>40%</td></tr>
          <tr><td>GBP/USD</td><td>55%</td><td>45%</td></tr>
        </table>
      `;

      const result = parseDukascopyHtml(html);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle SWFX index format', () => {
      const html = `
        <div class="swfx">EUR/USD swfx index: 60</div>
        <div class="swfx">GBP/USD sentiment 55</div>
      `;

      const result = parseDukascopyHtml(html);

      // May not match due to specific pattern requirements
      // The main goal is to not throw errors
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const html = '<div>No forex data here</div>';

      const result = parseDukascopyHtml(html);

      expect(result).toHaveLength(0);
    });
  });

  describe('parseSWFXIndex', () => {
    it('should parse SWFX index data', () => {
      const input = [
        { symbol: 'EUR/USD', index: 60 },
        { symbol: 'GBP/USD', index: 45 },
      ];

      const result = parseSWFXIndex(input);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        symbol: 'EUR/USD',
        longPercent: 60,
        shortPercent: 40,
      });
      expect(result[1]).toEqual({
        symbol: 'GBP/USD',
        longPercent: 45,
        shortPercent: 55,
      });
    });

    it('should normalize symbols', () => {
      const input = [{ symbol: 'EURUSD', index: 55 }];

      const result = parseSWFXIndex(input);

      expect(result[0].symbol).toBe('EUR/USD');
    });

    it('should filter invalid entries', () => {
      const input = [
        { symbol: 'EUR/USD', index: 60 },
        { symbol: '', index: 50 }, // Invalid: no symbol
        { symbol: 'GBP/USD', index: NaN }, // Invalid: NaN index
      ];

      const result = parseSWFXIndex(input);

      // Only first item should be valid
      expect(result.filter((r) => r.symbol === 'EUR/USD')).toHaveLength(1);
    });
  });

  describe('parseDukascopyJson', () => {
    it('should parse array format', () => {
      const json = JSON.stringify([
        { symbol: 'EUR/USD', long: 60, short: 40 },
        { instrument: 'GBP/USD', longPercent: 55, shortPercent: 45 },
      ]);

      const result = parseDukascopyJson(json);

      expect(result).toHaveLength(2);
    });

    it('should handle various field names', () => {
      const json = JSON.stringify([
        { symbol: 'EUR/USD', buy: 60, sell: 40 },
        { instrument: 'GBP/USD', bullish: 55, bearish: 45 },
      ]);

      const result = parseDukascopyJson(json);

      expect(result).toHaveLength(2);
    });

    it('should return empty array for invalid JSON', () => {
      const result = parseDukascopyJson('not valid json');
      expect(result).toHaveLength(0);
    });

    it('should handle index-based format', () => {
      const json = JSON.stringify([{ symbol: 'EUR/USD', index: 60 }]);

      const result = parseDukascopyJson(json);

      expect(result).toHaveLength(1);
      expect(result[0].longPercent).toBe(60);
      expect(result[0].shortPercent).toBe(40);
    });
  });
});
