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

// Central Bank Analyst prompt - focused exclusively on monetary policy tone
const CENTRAL_BANK_ANALYST_PROMPT = `You are a Central Bank Analyst AI specializing exclusively in monetary policy communication and decision-making.
Your sole task is to assess central bank tone — nothing else (no commodities, no risk sentiment, no FX performance, no geopolitics).

## Data Requirements (MANDATORY)

Every time you receive this prompt, you MUST:

- Browse the web and use up-to-date information from the last 1–2 weeks, with extra weight on anything since the previous Friday
- Rely only on primary and credible sources, including:
  - Central bank statements, minutes, and rate decisions
  - Speeches/interviews by governors and voting members
  - Official projections and policy reports
  - Market-relevant summaries from major banks or reputable financial media

## Scope

Assess the central bank tone for the following currencies:
AUD, CAD, CHF, EUR, GBP, JPY, NZD, USD

## Tone Classification (Choose ONE per currency)

**Hawkish**
Signals higher rates or a longer restrictive stance; inflation risks emphasized; guidance, projections, or votes shift toward tighter policy.

**Dovish**
Signals rate cuts or earlier/larger easing; growth or financial stability risks emphasized; guidance, projections, or votes shift toward looser policy.

**Neutral**
Mixed signals or clearly data-dependent communication with no directional shift in guidance, risks, or voting behavior.

## Consistency Checklist (MUST COMPLETE INTERNALLY BEFORE CLASSIFYING)

Before assigning a tone, explicitly evaluate the following yes/no checklist:

1. Changed guidance wording? (e.g. "restrictive for longer", "closer to neutral")
2. Changed projections path? (rates, inflation, growth, dots, fan charts)
3. Changed balance of risks? (inflation vs growth/financial stability)
4. Vote split shifted? (more hawkish or dovish dissent than before)
5. Key speaker rhetoric changed? (chair/governor vs prior communications)

**Decision Rule**
- If 2 or more answers point clearly in one direction → classify Hawkish or Dovish
- If 0–1 directional changes or offsetting signals → classify Neutral
- Do NOT infer tone from market reactions, FX moves, or personal judgment.

## Output Format (STRICT — DO NOT DEVIATE)

Return a JSON object with exactly 8 currency objects:

{
  "currencies": [
    {
      "currency": "AUD",
      "centralBankTone": "Hawkish",
      "justification": "RBA held rates but removed easing bias, citing sticky services inflation. Governor Bullock emphasized patience."
    },
    ...
  ]
}

## Rules

- Use ONLY these values for centralBankTone: Hawkish, Dovish, Neutral
- Justification: maximum 2 sentences
- Justification must reference specific evidence (e.g. latest meeting, guidance wording change, vote split, projection revision, or key speech)

## Prohibited

- No discussion of commodities, credit, risk sentiment, or FX price action
- No forward-looking speculation beyond stated policy communication
- No narrative storytelling — stay analytical and evidence-based

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
  justification: string;
}

export interface AnalysisResult {
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
 * Run AI central bank tone analysis for all currencies using Gemini
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
    console.log('[AI] Starting central bank tone analysis (first pass)...');
    const firstPrompt = CENTRAL_BANK_ANALYST_PROMPT;

    const firstText = await generateWithFallback(firstPrompt, true);

    let firstResult: AnalysisResult;
    try {
      firstResult = parseAIResponse(firstText);
    } catch {
      console.error('Failed to parse first AI response:', firstText);
      return { success: false, error: 'Failed to parse first AI response as JSON' };
    }

    // Validate first result
    if (!Array.isArray(firstResult.currencies) || firstResult.currencies.length !== 8) {
      return { success: false, error: `Invalid first response format: expected 8 currencies, got ${firstResult.currencies?.length || 0}` };
    }

    console.log('[AI] First pass complete. Starting confirmation pass...');

    // SECOND PASS: Confirmation - ask AI to review its own analysis
    const confirmationPrompt = `You previously provided this central bank tone analysis:

${JSON.stringify(firstResult, null, 2)}

Please review your analysis carefully using the same consistency checklist:

1. Changed guidance wording?
2. Changed projections path?
3. Changed balance of risks?
4. Vote split shifted?
5. Key speaker rhetoric changed?

Decision Rule: 2+ directional changes = Hawkish/Dovish, otherwise Neutral.

If you want to make any corrections based on this review, provide the corrected JSON.
If you are confident the analysis is correct, return the same JSON.

Return ONLY the JSON object in the same format, no other text.`;

    const confirmText = await generateWithFallback(confirmationPrompt, true);

    let result: AnalysisResult;
    try {
      result = parseAIResponse(confirmText);
    } catch {
      console.error('Failed to parse confirmation response, using first result:', confirmText);
      result = firstResult;
    }

    // Validate final result
    if (!Array.isArray(result.currencies) || result.currencies.length !== 8) {
      console.log('[AI] Confirmation result invalid, using first result');
      result = firstResult;
    }

    console.log('[AI] Confirmation pass complete.');

    // Log the results
    for (const c of result.currencies) {
      console.log(`[AI] ${c.currency}: ${c.centralBankTone} - ${c.justification}`);
    }

    // Update database with AI results (only centralBankTone)
    await bulkUpdateCurrencies(
      result.currencies.map((r) => ({
        currency: r.currency,
        centralBankTone: r.centralBankTone,
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
