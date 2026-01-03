/**
 * Manual script to fetch all fundamental data
 * Run with: npx tsx scripts/fetch-fundamental-data.ts
 */

// Load environment variables manually
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

async function main() {
  console.log('=== Fetching Fundamental Data ===\n');

  // 1. Fetch FRED data (VIX, US yields, Oil)
  if (process.env.FRED_API_KEY) {
    console.log('1. Fetching FRED data...');
    try {
      const { updateAllFredData } = await import('../src/services/fred.service');
      const fredResult = await updateAllFredData();
      console.log(`   VIX: ${fredResult.vix.count} records`);
      console.log(`   US 2Y Yield: ${fredResult.usYield.count} records`);
      console.log(`   WTI Oil: ${fredResult.oil.count} records\n`);
    } catch (error) {
      console.error('   FRED error:', error);
    }
  } else {
    console.log('1. Skipping FRED - no API key\n');
  }

  // 2. Fetch international yields from Trading Economics
  console.log('2. Fetching international yields...');
  try {
    const { updateYieldData, applyYieldDifferentials } = await import('../src/services/yields.service');
    const yieldResult = await updateYieldData();
    console.log(`   Updated ${yieldResult.updated} currencies`);
    await applyYieldDifferentials();
    console.log('   Yield differentials applied\n');
  } catch (error) {
    console.error('   Yields error:', error);
  }

  // 3. Fetch commodity prices
  console.log('3. Fetching commodity prices...');
  try {
    const { updateCommodityData, applyCommodityTailwinds } = await import('../src/services/commodities.service');
    const commodityResult = await updateCommodityData();
    console.log(`   Updated ${commodityResult.updated} commodities`);
    await applyCommodityTailwinds();
    console.log('   Commodity tailwinds applied\n');
  } catch (error) {
    console.error('   Commodities error:', error);
  }

  // 4. Calculate risk sentiment from VIX
  console.log('4. Calculating risk sentiment...');
  try {
    const { updateRiskRegime, applyRiskOverlays } = await import('../src/services/risk-sentiment.service');
    const riskResult = await updateRiskRegime();
    console.log(`   Risk regime: ${riskResult.regime}`);
    console.log(`   ${riskResult.justification}`);
    await applyRiskOverlays();
    console.log('   Risk overlays applied\n');
  } catch (error) {
    console.error('   Risk error:', error);
  }

  // 5. Recalculate final scores
  console.log('5. Recalculating scores...');
  try {
    const { recalculateAllScores } = await import('../src/services/fundamental.service');
    await recalculateAllScores();
    console.log('   Scores recalculated\n');
  } catch (error) {
    console.error('   Scores error:', error);
  }

  console.log('=== Done ===');
  process.exit(0);
}

main().catch(console.error);
