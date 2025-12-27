import { NextRequest, NextResponse } from 'next/server';
import { sendAccessRequestEmail } from '@/lib/email';
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

    // Send email (don't store in DB per requirements)
    await sendAccessRequestEmail({ name: name.trim(), email: email.trim(), reason: reason.trim() });

    return NextResponse.json(
      { message: 'Access request submitted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Access request error:', error);

    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('EAUTH') || errorMessage.includes('Invalid login')) {
      return NextResponse.json(
        { error: 'Email authentication failed. Please check SMTP credentials.' },
        { status: 500 }
      );
    }

    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
      return NextResponse.json(
        { error: 'Could not connect to email server. Please check SMTP settings.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit access request. Please try again later.' },
      { status: 500 }
    );
  }
}
