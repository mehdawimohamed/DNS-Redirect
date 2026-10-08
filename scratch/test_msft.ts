import { middleware } from '../src/middleware';
import { NextRequest } from 'next/server';

function testUrl(urlStr: string, hostHeader: string) {
  const req = new NextRequest(new URL(urlStr), {
    headers: { host: hostHeader }
  });
  const res = middleware(req);
  const status = res ? res.status : 200;
  const location = res ? res.headers.get('location') : null;

  console.log(`URL: ${urlStr}`);
  console.log(`Host: ${hostHeader}`);
  console.log(`Status: ${status}`);
  console.log(`Location Header: ${location}\n`);
}

console.log('--- Testing Windows msftconnecttest Probe URLs ---\n');
testUrl('http://www.msftconnecttest.com/connecttest.txt', 'www.msftconnecttest.com');
testUrl('http://www.msftconnecttest.com/redirect', 'www.msftconnecttest.com');
testUrl('http://www.msftconnecttest.com/wifi', 'www.msftconnecttest.com');
