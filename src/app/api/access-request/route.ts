import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateEmail } from '@/services/user.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, reason } = body;

    // Validate required fields
    if (!name || !email || !reason) {
      return NextResponse.json(
        { error: 'Name, email, and reason are required' },
        { status: 400 }
      );
    }

    // Validate name length
    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please provide your full name' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate reason length
    if (reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a more detailed reason' },
        { status: 400 }
      );
    }

    // Save to database
    await prisma.accessRequest.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        reason: reason.trim(),
      },
    });

    return NextResponse.json(
      { message: 'Access request submitted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Access request error:', error);
    return NextResponse.json(
      { error: 'Failed to submit access request. Please try again later.' },
      { status: 500 }
    );
  }
}
