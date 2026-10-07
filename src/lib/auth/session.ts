import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { User, UserSession } from '@/types';

const SESSION_COOKIE_NAME = 'wifi_app_session';
const SESSION_DURATION_HOURS = 24 * 7; // 7 days

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);

  await db.userSessions.create({
    userId,
    sessionTokenHash: tokenHash,
    expiresAt: expiresAt.toISOString(),
    userAgent,
    ipAddress,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return rawToken;
}

export async function getCurrentSession(): Promise<{ user: User; session: UserSession } | null> {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!rawToken) {
      return null;
    }

    const tokenHash = hashToken(rawToken);
    const session = await db.userSessions.findByTokenHash(tokenHash);

    if (!session) {
      return null;
    }

    const user = await db.users.findById(session.userId);
    if (!user || user.status !== 'active') {
      return null;
    }

    return { user, session };
  } catch (err) {
    console.error('[getCurrentSession] Error:', err);
    return null;
  }
}

export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      const session = await db.userSessions.findByTokenHash(tokenHash);
      if (session) {
        await db.userSessions.revoke(session.id);
      }
    }

    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (err) {
    console.error('[destroySession] Error:', err);
  }
}
