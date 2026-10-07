import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { wifiAuthorizeSchema } from '@/schemas/wifi';
import { getWifiGatewayAdapter } from '@/lib/wifi/gateway-adapter';
import { db, DEFAULT_GATEWAY } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const sessionData = await getCurrentSession();

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in first.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parseResult = wifiAuthorizeSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid Wi-Fi authorization parameters.', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { gatewayId, gatewaySessionToken, clientMac, clientIp, durationMinutes } = parseResult.data;
    const clientMacAddr = clientMac || '00:00:00:00:00:00';
    const clientIpAddr = clientIp || '127.0.0.1';

    // Calculate Wi-Fi session expiration
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    // Call active Gateway Adapter (Mock or OpenNDS)
    const adapter = getWifiGatewayAdapter();
    const authResult = await adapter.authorizeClient({
      gatewayId: gatewayId || DEFAULT_GATEWAY.identifier,
      gatewaySessionToken,
      clientMac: clientMacAddr,
      clientIp: clientIpAddr,
      durationMinutes,
      userId: sessionData.user.id,
    });

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Gateway authorization failed.' },
        { status: 502 }
      );
    }

    // Record authorized Wi-Fi session in Database
    const wifiSession = await db.wifiSessions.create({
      userId: sessionData.user.id,
      gatewayId: DEFAULT_GATEWAY.id,
      clientIdentifier: clientMacAddr,
      ipAddress: clientIpAddr,
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      wifiSessionId: wifiSession.id,
      expiresAt: wifiSession.expiresAt,
      redirectUrl: authResult.redirectUrl || 'https://www.google.com',
    });
  } catch (err) {
    console.error('[POST /api/wifi/authorize] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
