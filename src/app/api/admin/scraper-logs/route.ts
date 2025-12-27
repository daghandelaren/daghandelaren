import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get logs from last 12 hours, ordered by most recent
    const logs = await prisma.scraperLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50, // Limit to last 50 logs
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch scraper logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scraper logs' },
      { status: 500 }
    );
  }
}
