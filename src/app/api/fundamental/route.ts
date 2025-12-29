/**
 * GET /api/fundamental - Get all currency scores and pair biases
 * PATCH /api/fundamental - Update a currency's indicators (admin only)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getAllCurrencies,
  getPairBiases,
  updateCurrency,
  getSettings,
} from '@/services/fundamental.service';
import { isConfigured } from '@/services/ai.service';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [currencies, pairBiases, settings] = await Promise.all([
      getAllCurrencies(),
      getPairBiases(),
      getSettings(),
    ]);

    return NextResponse.json({
      currencies,
      pairBiases,
      settings: {
        riskRegime: settings.riskRegime,
        riskSentimentJustification: settings.riskSentimentJustification,
        bullishThreshold: settings.bullishThreshold,
        bearishThreshold: settings.bearishThreshold,
        lastUpdated: settings.lastUpdated.toISOString(),
      },
      aiConfigured: isConfigured(),
    });
  } catch (error) {
    console.error('Error fetching fundamental data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fundamental data' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { currency, ...data } = body;

    if (!currency) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 });
    }

    const updated = await updateCurrency(currency, {
      ...data,
      manualOverride: true,
      updatedBy: session.user?.email ?? 'admin',
    });

    return NextResponse.json({ success: true, currency: updated });
  } catch (error) {
    console.error('Error updating currency:', error);
    return NextResponse.json(
      { error: 'Failed to update currency' },
      { status: 500 }
    );
  }
}
