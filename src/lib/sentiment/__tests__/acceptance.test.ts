import { describe, it, expect } from 'vitest';
import { computeContrarian } from '../contrarian';
import { computeWeightedBlend } from '../blend';

describe('Acceptance Tests', () => {
  describe('Contrarian Sentiment Rules', () => {
    it('80/20 should display BEARISH and contrarian bias SHORT', () => {
      // 80% long, 20% short => retail is net long => our bias = SHORT (BEARISH)
      const result = computeContrarian(80, 20);

      expect(result.bias).toBe('SHORT');
      expect(result.label).toBe('BEARISH');
      expect(result.strength).toBe(60);
    });

    it('20/80 should display BULLISH and contrarian bias LONG', () => {
      // 20% long, 80% short => retail is net short => our bias = LONG (BULLISH)
      const result = computeContrarian(20, 80);

      expect(result.bias).toBe('LONG');
      expect(result.label).toBe('BULLISH');
      expect(result.strength).toBe(60);
    });

    it('60/40 triggers signal (>= 20pp threshold)', () => {
      // 60% long, 40% short => strength = 20 => should trigger BEARISH
      const result = computeContrarian(60, 40);

      expect(result.bias).toBe('SHORT');
      expect(result.label).toBe('BEARISH');
      expect(result.strength).toBe(20);
    });

    it('59/41 shows NEUTRAL (below 20pp threshold)', () => {
      // 59% long, 41% short => strength = 18 => should be NEUTRAL
      const result = computeContrarian(59, 41);

      expect(result.bias).toBe('NEUTRAL');
      expect(result.label).toBe('NEUTRAL');
      expect(result.strength).toBe(18);
    });

    it('40/60 triggers BULLISH signal', () => {
      // 40% long, 60% short => retail net short => BULLISH
      const result = computeContrarian(40, 60);

      expect(result.bias).toBe('LONG');
      expect(result.label).toBe('BULLISH');
      expect(result.strength).toBe(20);
    });

    it('50/50 is NEUTRAL', () => {
      const result = computeContrarian(50, 50);

      expect(result.bias).toBe('NEUTRAL');
      expect(result.label).toBe('NEUTRAL');
      expect(result.strength).toBe(0);
    });

    it('55/45 is NEUTRAL (10pp difference)', () => {
      const result = computeContrarian(55, 45);

      expect(result.bias).toBe('NEUTRAL');
      expect(result.label).toBe('NEUTRAL');
      expect(result.strength).toBe(10);
    });
  });

  describe('Weighted Blended Sentiment', () => {
    it('M=80, O=70, D=60 => blended_long = 72, blended_short = 28 => BEARISH', () => {
      // Weights: M=2, O=2, D=1
      // blended_long = (2*80 + 2*70 + 1*60) / (2+2+1) = (160 + 140 + 60) / 5 = 360/5 = 72
      const result = computeWeightedBlend({
        myfxbook: { longPercent: 80, shortPercent: 20 },
        oanda: { longPercent: 70, shortPercent: 30 },
        dukascopy: { longPercent: 60, shortPercent: 40 },
      });

      expect(result.blendedLong).toBe(72);
      expect(result.blendedShort).toBe(28);
      expect(result.sourcesUsed).toContain('myfxbook');
      expect(result.sourcesUsed).toContain('oanda');
      expect(result.sourcesUsed).toContain('dukascopy');
      expect(result.totalWeight).toBe(5);

      // Verify this results in BEARISH (retail 72% long)
      const contrarian = computeContrarian(result.blendedLong, result.blendedShort);
      expect(contrarian.label).toBe('BEARISH');
      expect(contrarian.strength).toBe(44); // 72 - 28
    });

    it('Only M=60, O=40 => blended_long = 50 (weighted)', () => {
      // Weights: M=2, O=2
      // blended_long = (2*60 + 2*40) / (2+2) = (120 + 80) / 4 = 50
      const result = computeWeightedBlend({
        myfxbook: { longPercent: 60, shortPercent: 40 },
        oanda: { longPercent: 40, shortPercent: 60 },
      });

      expect(result.blendedLong).toBe(50);
      expect(result.blendedShort).toBe(50);
      expect(result.sourcesUsed).toEqual(['myfxbook', 'oanda']);
      expect(result.totalWeight).toBe(4);
      expect(result.weightsUsed).toEqual({ M: 2, O: 2, D: 0 });

      // 50/50 should be NEUTRAL
      const contrarian = computeContrarian(result.blendedLong, result.blendedShort);
      expect(contrarian.label).toBe('NEUTRAL');
    });

    it('Only Dukascopy has data', () => {
      // Only D=80 => weight 1
      const result = computeWeightedBlend({
        dukascopy: { longPercent: 80, shortPercent: 20 },
      });

      expect(result.blendedLong).toBe(80);
      expect(result.blendedShort).toBe(20);
      expect(result.sourcesUsed).toEqual(['dukascopy']);
      expect(result.totalWeight).toBe(1);
    });

    it('No sources available returns 50/50', () => {
      const result = computeWeightedBlend({});

      expect(result.blendedLong).toBe(50);
      expect(result.blendedShort).toBe(50);
      expect(result.sourcesUsed).toEqual([]);
      expect(result.totalWeight).toBe(0);
    });

    it('Null sources are ignored', () => {
      const result = computeWeightedBlend({
        myfxbook: { longPercent: 80, shortPercent: 20 },
        oanda: null,
        dukascopy: undefined,
      });

      expect(result.blendedLong).toBe(80);
      expect(result.blendedShort).toBe(20);
      expect(result.sourcesUsed).toEqual(['myfxbook']);
      expect(result.totalWeight).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('Exactly at threshold (20pp) triggers signal', () => {
      // 60% long, 40% short => difference = 20 => triggers BEARISH
      const result1 = computeContrarian(60, 40);
      expect(result1.label).toBe('BEARISH');

      // 40% long, 60% short => difference = 20 => triggers BULLISH
      const result2 = computeContrarian(40, 60);
      expect(result2.label).toBe('BULLISH');
    });

    it('Just below threshold (19pp) is NEUTRAL', () => {
      const result = computeContrarian(59.5, 40.5);
      expect(result.label).toBe('NEUTRAL');
      expect(result.strength).toBe(19);
    });

    it('Extreme values work correctly', () => {
      const result1 = computeContrarian(100, 0);
      expect(result1.label).toBe('BEARISH');
      expect(result1.strength).toBe(100);

      const result2 = computeContrarian(0, 100);
      expect(result2.label).toBe('BULLISH');
      expect(result2.strength).toBe(100);
    });
  });
});
