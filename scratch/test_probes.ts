import { middleware } from '../src/middleware';
import { NextRequest } from 'next/server';

function testProbe(urlStr: string, hostHeader: string, isAuthenticated: boolean, expectedStatus: number, expectedLocation?: string, expectedBody?: string) {
  const headers: Record<string, string> = { host: hostHeader };
  if (isAuthenticated) {
    headers['cookie'] = 'wifi_app_session=test_session_token_123';
  }

  const req = new NextRequest(new URL(urlStr), { headers });
  const res = middleware(req);

  const status = res ? res.status : 200;
  const location = res ? res.headers.get('location') : null;

  console.log(`[TEST] Host: ${hostHeader} | Auth: ${isAuthenticated} | URL: ${urlStr}`);
  console.log(`       Status: ${status} | Location: ${location}`);

  if (status !== expectedStatus) {
    throw new Error(`Expected status ${expectedStatus} but got ${status}`);
  }

  if (expectedLocation && !location?.endsWith(expectedLocation)) {
    throw new Error(`Expected location ending with ${expectedLocation} but got ${location}`);
  }

  console.log(`       ✅ PASSED (Status ${status})\n`);
}

console.log('=== Running Captive Portal Probe Redirection & Auth Tests ===\n');

// Unauthenticated tests (302 Redirect to portal)
testProbe('http://connectivitycheck.gstatic.com/generate_204', 'connectivitycheck.gstatic.com', false, 302, '/wifi');
testProbe('http://captive.apple.com/hotspot-detect.html', 'captive.apple.com', false, 302, '/wifi');
testProbe('http://www.msftconnecttest.com/connecttest.txt', 'www.msftconnecttest.com', false, 302, '/wifi');

// Authenticated tests (204 / 200 Success - popup NEVER triggers again)
testProbe('http://connectivitycheck.gstatic.com/generate_204', 'connectivitycheck.gstatic.com', true, 204);
testProbe('http://captive.apple.com/hotspot-detect.html', 'captive.apple.com', true, 200);
testProbe('http://www.msftconnecttest.com/connecttest.txt', 'www.msftconnecttest.com', true, 200);

// Portal pages pass-through
testProbe('http://192.168.1.100/wifi', '192.168.1.100', false, 200);

console.log('🎉 ALL PRE-AUTH AND POST-AUTH PROBE TESTS PASSED SUCCESSFULLY!');
