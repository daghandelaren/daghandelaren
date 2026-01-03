/**
 * Script to manually run fundamental analysis
 * Run with: npx tsx scripts/run-fundamental-analysis.ts
 */

// Load .env file (Node.js 22+)
import { resolve } from 'path';
import { loadEnvFile } from 'process';
try {
  loadEnvFile(resolve(process.cwd(), '.env'));
} catch {
  // .env may not exist
}

async function main() {
  console.log('Starting fundamental analysis...\n');

  // 1. Update economic data (Core CPI)
  console.log('=== Step 1: Fetching Core CPI from ForexFactory ===');
  try {
    const { updateEconomicData } = await import('../src/services/economic-data.service');
    const econResult = await updateEconomicData();
    console.log(`CPI update: ${econResult.updated} currencies updated`);
    if (econResult.errors.length > 0) {
      console.log('Errors:', econResult.errors);
    }
  } catch (error) {
    console.error('CPI update failed:', error);
  }

  console.log('');

  // 2. Update PMI data
  console.log('=== Step 2: Fetching PMI from ForexFactory ===');
  try {
    const { updatePmiData } = await import('../src/services/pmi-data.service');
    const pmiResult = await updatePmiData();
    console.log(`PMI update: ${pmiResult.updated} currencies updated`);
    if (pmiResult.errors.length > 0) {
      console.log('Errors:', pmiResult.errors);
    }
  } catch (error) {
    console.error('PMI update failed:', error);
  }

  console.log('');

  // 3. Run AI analysis
  console.log('=== Step 3: Running AI Analysis (Gemini) ===');
  if (!process.env.GEMINI_API_KEY) {
    console.log('Skipping - GEMINI_API_KEY not configured');
  } else {
    try {
      const { analyzeMarket } = await import('../src/services/ai.service');
      const aiResult = await analyzeMarket();

      if (aiResult.success) {
        console.log('AI analysis completed successfully');
        if (aiResult.result) {
          console.log('\nCentral Bank Tone Results:');
          for (const r of aiResult.result.currencies) {
            console.log(`  ${r.currency}: ${r.centralBankTone} - ${r.justification}`);
          }
        }
      } else {
        console.log('AI analysis failed:', aiResult.error);
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    }
  }

  console.log('');

  // 4. Recalculate scores
  console.log('=== Step 4: Recalculating Scores ===');
  try {
    const { recalculateAllScores, getAllCurrencies } = await import('../src/services/fundamental.service');
    await recalculateAllScores();

    const currencies = await getAllCurrencies();
    console.log('\nFinal Currency Scores:');
    for (const c of currencies) {
      console.log(`  ${c.currency}: Score=${c.totalScore}, Rating=${c.rating}`);
    }
  } catch (error) {
    console.error('Score recalculation failed:', error);
  }

  console.log('\n=== Fundamental analysis complete ===');
  process.exit(0);
}

main().catch(console.error);
