import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Cookie key used for authenticated user sessions
 */
const SESSION_COOKIE_NAME = 'wifi_app_session';

/**
 * Known OS Captive Portal Probe Hostnames
 */
const CAPTIVE_PROBE_HOSTNAMES = new Set([
  // Android / Google probes
  'connectivitycheck.gstatic.com',
  'connectivitycheck.android.com',
  'clients3.google.com',
  'play.googleapis.com',
  
  // Apple / iOS / macOS probes
  'captive.apple.com',
  'www.apple.com',
  'apple.com',
  'gsp1.apple.com',
  'www.ibook.info',
  'www.itools.info',
  'www.thinkdifferent.us',
  'www.airport.us',

  // Windows / Microsoft probes
  'www.msftconnecttest.com',
  'msftconnecttest.com',
  'www.msftncsi.com',
  'msftncsi.com',
  'ipv6.msftconnecttest.com',
]);

/**
 * Known OS Captive Portal Probe Request Paths
 */
const CAPTIVE_PROBE_PATHS = new Set([
  '/generate_204',
  '/gen_204',
  '/hotspot-detect.html',
  '/library/test/success.html',
  '/connecttest.txt',
  '/ncsi.txt',
  '/canonical.html',
  '/success.txt',
]);

/**
 * Helper to answer OS probes with expected SUCCESS responses post-login
 */
function handleAuthenticatedProbe(host: string, pathname: string) {
  // Apple probe expected response
  if (host.includes('apple.com') || pathname.includes('hotspot-detect')) {
    return new NextResponse('<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  // Windows probe expected response
  if (host.includes('msftconnecttest') || host.includes('msftncsi') || pathname.includes('connecttest')) {
    return new NextResponse('Microsoft Connect Test', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // Android / default probe expected 204 No Content response
  return new NextResponse(null, { status: 204 });
}

/**
 * Next.js Middleware for Captive Portal Probe Interception and 302 Redirection
 */
export function middleware(request: NextRequest) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  // 1. Bypass internal Next.js assets, static files, and API endpoints
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/static/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Allow requests that have reached portal pages
  if (pathname === '/wifi' || pathname === '/login' || pathname === '/wifi/success') {
    return NextResponse.next();
  }

  const isProbeHost = CAPTIVE_PROBE_HOSTNAMES.has(host);
  const isProbePath = CAPTIVE_PROBE_PATHS.has(pathname);
  const isExternalRequest = isProbeHost || isProbePath || (host !== 'localhost' && !host.startsWith('127.0.0.1'));

  // 3. POST-AUTHENTICATION behavior:
  // If the user has logged in (valid session cookie exists) and an OS probe arrives, reply with SUCCESS (204 / "Success").
  // This tells Android, iOS, and Windows that internet access is active so the popup NEVER triggers again.
  if (isAuthenticated && isExternalRequest) {
    return handleAuthenticatedProbe(host, pathname);
  }

  // 4. PRE-AUTHENTICATION behavior:
  // Intercept probe or external request and reply with 302 Redirect to /wifi
  if (isExternalRequest) {
    const portalUrl = new URL('/wifi', request.url);
    if (search) {
      portalUrl.search = search;
    }

    return NextResponse.redirect(portalUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!.*\\.[\\w]+$).*)',
  ],
};
