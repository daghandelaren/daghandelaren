/**
 * AI Service - Google Gemini with Search Grounding
 * Handles market analysis and chat functionality with live web search
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { bulkUpdateCurrencies, getAllCurrencies } from './fundamental.service';

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Models to try in order of preference
const GEMINI_MODELS = [
  'gemini-2.5-flash',      // Latest stable with best free tier
  'gemini-2.0-flash-001',  // Fallback stable
  'gemini-2.5-pro',        // Pro version if flash fails
];

// Macro analyst system prompt
const MACRO_ANALYST_PROMPT = `You are a macro/FX analyst AI. You are preparing a daily FX macro snapshot based on your knowledge of recent market events.

For each of the following currencies: AUD, CAD, CHF, EUR, GBP, JPY, NZD, USD

Determine and report based on recent central bank communications, economic data, and market conditions:

1) Central bank tone
Possible values (choose ONE): **Hawkish, Neutral, Dovish**
- "Hawkish": signalling higher rates or longer restrictive stance, strong focus on inflation risks
- "Dovish": signalling cuts or earlier/larger easing, focus on growth/financial stability risks
- "Neutral": mixed signals or clearly "data dependent" without a strong directional bias

2) Rate differential (vs USD)
Possible values (choose ONE): **Positive, Flat, Negative**
- "Positive": this currency has higher policy rate or yield advantage vs USD
- "Negative": this currency has lower policy rate or yield disadvantage vs USD
- "Flat": roughly similar rates to USD or USD itself

3) Credit conditions
Possible values (choose ONE): **Easing, Neutral, Tightening**
- "Easing": improving credit availability, narrower spreads, supportive policy measures
- "Tightening": reduced credit availability, stricter lending standards, higher spreads
- "Neutral": no clear directional change or mixed signals

4) Commodity tailwind
Possible values (choose ONE): **Yes, No, Neutral**
- "Yes": recent commodity price dynamics are a net positive for this currency
- "No": recent commodity price dynamics are a net headwind
- "Neutral": limited or mixed impact

OUTPUT FORMAT (CRITICAL - follow exactly):
Return a JSON object with:
1. "riskSentiment": The GLOBAL market risk sentiment (Risk-on, Neutral, or Risk-off)
   - "Risk-on": markets favor risky assets (equities up, VIX low, credit spreads tight)
   - "Risk-off": markets favor safe havens (equities down, VIX elevated, flight to quality)
   - "Neutral": mixed signals or no clear risk bias
2. "riskSentimentJustification": 2-3 sentences explaining WHY you chose this risk sentiment, citing specific market indicators (VIX level, equity performance, credit spreads, etc.)
3. "currencies": An array with exactly 8 objects, one for each currency

Each currency object must have these exact keys:
- currency: string (AUD, CAD, CHF, EUR, GBP, JPY, NZD, USD)
- centralBankTone: string (Hawkish, Neutral, or Dovish)
- rateDifferential: string (Positive, Flat, or Negative)
- creditConditions: string (Easing, Neutral, or Tightening)
- commodityTailwind: string (Yes, No, or Neutral)
- justification: string (1-2 sentences explaining the key drivers)

Example format:
{
  "riskSentiment": "Risk-on",
  "riskSentimentJustification": "Global equities near all-time highs with S&P 500 up 2% this week. VIX at 13.5 indicates low fear. Credit spreads remain tight supporting risk appetite.",
  "currencies": [
    {
      "currency": "AUD",
      "centralBankTone": "Hawkish",
      "rateDifferential": "Positive",
      "creditConditions": "Neutral",
      "commodityTailwind": "Yes",
      "justification": "RBA maintained hawkish stance citing sticky services inflation. Iron ore prices supporting AUD."
    },
    ...
  ]
}

Return ONLY the JSON object, no other text.`;

// Chat system prompt
const CHAT_SYSTEM_PROMPT = `You are a knowledgeable macro/FX analyst assistant. You help traders understand:
- Central bank policies and their implications
- Economic data releases and their market impact
- Currency dynamics and cross-currency relationships
- Risk sentiment and market positioning
- Geopolitical factors affecting FX markets

Be concise, specific, and actionable in your responses. Reference specific data points or events when possible.`;

export interface CurrencyAnalysis {
  currency: string;
  centralBankTone: string;
  rateDifferential: string;
  creditConditions: string;
  commodityTailwind: string;
  justification: string;
}

export interface AnalysisResult {
  riskSentiment: string; // Global: Risk-on, Neutral, Risk-off
  riskSentimentJustification: string; // AI's reasoning for risk sentiment
  currencies: CurrencyAnalysis[];
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Try to generate content with fallback models
 * @param prompt - The prompt to send
 * @param useSearch - Whether to enable Google Search grounding for real-time data
 */
async function generateWithFallback(prompt: string, useSearch: boolean = false): Promise<string> {
  let lastError: Error | null = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      console.log(`[AI] Trying model: ${modelName}${useSearch ? ' with search' : ''}`);

      // Configure model with optional Google Search grounding
      const modelConfig: any = { model: modelName };
      if (useSearch) {
        modelConfig.tools = [{ googleSearch: {} }];
      }

      const model = genAI.getGenerativeModel(modelConfig);

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const response = result.response;
      const text = response.text();

      console.log(`[AI] Success with model: ${modelName}`);
      return text;
    } catch (error: any) {
      lastError = error;
      console.error(`[AI] Model ${modelName} failed:`, error.message);

      // If rate limited, wait before trying next model
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        const retryMatch = error.message.match(/retry in (\d+)/i);
        const waitTime = retryMatch ? parseInt(retryMatch[1]) * 1000 : 5000;
        console.log(`[AI] Rate limited, waiting ${waitTime}ms before trying next model`);
        await sleep(Math.min(waitTime, 10000)); // Cap at 10 seconds
      }

      // Continue to next model
      continue;
    }
  }

  // If search failed, try without search as fallback
  if (useSearch) {
    console.log('[AI] All models with search failed, trying without search');
    return generateWithFallback(prompt, false);
  }

  throw lastError || new Error('All models failed');
}

/**
 * Parse AI JSON response, handling markdown code blocks
 */
function parseAIResponse(text: string): AnalysisResult {
  let jsonStr = text;
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }
  return JSON.parse(jsonStr.trim());
}

/**
 * Run AI market analysis for all currencies using Gemini
 * Uses a two-pass approach: initial analysis + confirmation
 */
export async function analyzeMarket(): Promise<{
  success: boolean;
  result?: AnalysisResult;
  error?: string;
}> {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: 'GEMINI_API_KEY not configured' };
  }

  try {
    // FIRST PASS: Initial analysis
    console.log('[AI] Starting first pass analysis...');
    const firstPrompt = MACRO_ANALYST_PROMPT + '\n\nAnalyze the current macro environment for all 8 major currencies and provide your assessment based on your latest knowledge.';

    const firstText = await generateWithFallback(firstPrompt, true);

    let firstResult: AnalysisResult;
    try {
      firstResult = parseAIResponse(firstText);
    } catch {
      console.error('Failed to parse first AI response:', firstText);
      return { success: false, error: 'Failed to parse first AI response as JSON' };
    }

    // Validate first result
    if (!firstResult.riskSentiment || !Array.isArray(firstResult.currencies) || firstResult.currencies.length !== 8) {
      return { success: false, error: `Invalid first response format: expected 8 currencies, got ${firstResult.currencies?.length || 0}` };
    }

    console.log('[AI] First pass complete. Starting confirmation pass...');

    // SECOND PASS: Confirmation - ask AI to review its own analysis
    const confirmationPrompt = `You previously provided this FX macro analysis:

${JSON.stringify(firstResult, null, 2)}

Please review your analysis carefully. Are you confident in these assessments?

Consider:
- Is each central bank tone accurate based on recent communications?
- Are the rate differentials correct relative to current policy rates?
- Do the credit conditions reflect the actual lending environment?
- Are commodity tailwinds/headwinds accurate for commodity-linked currencies (AUD, CAD, NZD)?

If you want to make any changes, provide the corrected full JSON response.
If you are confident the analysis is correct, return the same JSON response.

Return ONLY the JSON object in the same format, no other text.`;

    const confirmText = await generateWithFallback(confirmationPrompt, true);

    let result: AnalysisResult;
    try {
      result = parseAIResponse(confirmText);
    } catch {
      console.error('Failed to parse confirmation response, using first result:', confirmText);
      // Fall back to first result if confirmation parsing fails
      result = firstResult;
    }

    // Validate final result
    if (!result.riskSentiment || !Array.isArray(result.currencies) || result.currencies.length !== 8) {
      console.log('[AI] Confirmation result invalid, using first result');
      result = firstResult;
    }

    console.log('[AI] Confirmation pass complete.');

    // Update global risk regime and justification in settings
    const { updateSettings } = await import('./fundamental.service');
    await updateSettings({
      riskRegime: result.riskSentiment,
      riskSentimentJustification: result.riskSentimentJustification || '',
    });
    console.log(`[AI] Updated global risk regime to: ${result.riskSentiment}`);
    console.log(`[AI] Risk sentiment justification: ${result.riskSentimentJustification || 'N/A'}`);

    // Update database with AI results (only the fields AI analyzes)
    await bulkUpdateCurrencies(
      result.currencies.map((r) => ({
        currency: r.currency,
        centralBankTone: r.centralBankTone,
        rateDifferential: r.rateDifferential,
        creditConditions: r.creditConditions,
        commodityTailwind: r.commodityTailwind,
        aiJustification: r.justification,
      })),
      'AI'
    );

    return { success: true, result };
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Chat with the AI about macro/FX topics using Gemini
 */
export async function chat(
  userId: string,
  userMessage: string
): Promise<{
  success: boolean;
  response?: string;
  error?: string;
}> {
  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: 'GEMINI_API_KEY not configured' };
  }

  try {
    // Get current fundamental data as context
    const currencies = await getAllCurrencies();
    const contextData = currencies.map((c) => ({
      currency: c.currency,
      rating: c.rating,
      totalScore: c.totalScore,
      indicators: {
        inflation: c.inflationTrend,
        pmi: c.pmiSignal,
        centralBank: c.centralBankTone,
        rateDiff: c.rateDifferential,
        credit: c.creditConditions,
        commodity: c.commodityTailwind,
      },
      justification: c.aiJustification,
    }));

    // Get recent chat history
    const history = await prisma.aIChatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Build context with history
    const historyText = history
      .reverse()
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    const fullPrompt = `${CHAT_SYSTEM_PROMPT}

Current fundamental analysis data for reference:
${JSON.stringify(contextData, null, 2)}

${historyText ? `Recent conversation:\n${historyText}\n\n` : ''}User question: ${userMessage}

Please provide a helpful response:`;

    // Generate response with search grounding for real-time data
    const assistantMessage = await generateWithFallback(fullPrompt, true);

    // Save messages to database
    await prisma.aIChatMessage.createMany({
      data: [
        { userId, role: 'user', content: userMessage },
        { userId, role: 'assistant', content: assistantMessage },
      ],
    });

    return { success: true, response: assistantMessage };
  } catch (error) {
    console.error('AI chat error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(
  userId: string,
  limit: number = 50
): Promise<Array<{ id: string; role: string; content: string; createdAt: Date }>> {
  return prisma.aIChatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

/**
 * Clear chat history for a user
 */
export async function clearChatHistory(userId: string): Promise<void> {
  await prisma.aIChatMessage.deleteMany({
    where: { userId },
  });
}

/**
 * Check if API key is configured
 */
export function isConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
