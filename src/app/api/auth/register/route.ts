import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { registerSchema } from '@/schemas/auth';
import { createSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = registerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid registration parameters.', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { email, password, displayName } = parseResult.data;

    const existingUser = await db.users.findByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    // Direct plaintext password storage per user specification override
    const newUser = await db.users.create({
      email,
      password,
      displayName,
    });

    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for') || undefined;

    await createSession(newUser.id, userAgent, ipAddress);

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
      },
    });
  } catch (err) {
    console.error('[POST /api/auth/register] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
