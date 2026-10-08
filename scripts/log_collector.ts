import fs from 'fs';
import readline from 'readline';
import { db } from '../src/lib/db';

/**
 * Log Collector Script for dnsmasq -> PostgreSQL Activity Logs
 *
 * Tails /var/log/dnsmasq.log in real-time, extracts requested domains and client IPs,
 * matches active user sessions, and saves logs into user_activity_logs table.
 */
const LOG_FILE_PATH = process.env.DNSMASQ_LOG_PATH || '/var/log/dnsmasq.log';

// Regex matching standard dnsmasq query log entries:
// Oct 08 02:10:15 dnsmasq[1234]: query[A] example.com from 192.168.1.50
const QUERY_LOG_REGEX = /dnsmasq\[\d+\]:\s+query\[[A-Z0-9]+\]\s+([^\s]+)\s+from\s+([0-9a-fA-F.:]+)/;

async function processLogLine(line: string) {
  const match = line.match(QUERY_LOG_REGEX);
  if (!match) return;

  const domainRequested = match[1].toLowerCase();
  const clientIp = match[2];

  // Ignore internal local domain queries or noise
  if (
    domainRequested.endsWith('.local') ||
    domainRequested.endsWith('.arpa') ||
    domainRequested === 'localhost'
  ) {
    return;
  }

  try {
    // Attempt to resolve active logged-in user by client IP
    let userId: string | null = null;
    try {
      // Find active session for client IP if available
      const activeSession = await db.wifiSessions.findActiveByUserId(clientIp);
      if (activeSession) {
        userId = activeSession.userId;
      }
    } catch {
      // Pre-login / null user_id fallback
    }

    // Insert activity record into database
    await db.userActivityLogs.create({
      userId,
      clientIp,
      domainRequested,
    });

    console.log(`[LogCollector] Recorded: ${clientIp} -> ${domainRequested} (User: ${userId || 'Pre-Login'})`);
  } catch (err) {
    console.error(`[LogCollector] Error saving log entry for ${domainRequested}:`, err);
  }
}

function startTailingLogs() {
  console.log(`🚀 Starting dnsmasq Log Collector watching: ${LOG_FILE_PATH}`);

  if (!fs.existsSync(LOG_FILE_PATH)) {
    console.warn(`[LogCollector] Log file not found at ${LOG_FILE_PATH}. Creating empty file...`);
    try {
      fs.writeFileSync(LOG_FILE_PATH, '');
    } catch (e) {
      console.error(`[LogCollector] Unable to create ${LOG_FILE_PATH}:`, e);
      return;
    }
  }

  // Tail file continuously
  let fileSize = fs.statSync(LOG_FILE_PATH).size;

  fs.watch(LOG_FILE_PATH, (eventType) => {
    if (eventType === 'change') {
      const newSize = fs.statSync(LOG_FILE_PATH).size;
      if (newSize < fileSize) {
        // File truncated/rotated
        fileSize = 0;
      }
      
      const stream = fs.createReadStream(LOG_FILE_PATH, {
        start: fileSize,
        end: newSize,
        encoding: 'utf8',
      });

      const rl = readline.createInterface({ input: stream });

      rl.on('line', (line) => {
        if (line.trim()) {
          processLogLine(line.trim());
        }
      });

      fileSize = newSize;
    }
  });
}

// Run collector
startTailingLogs();
