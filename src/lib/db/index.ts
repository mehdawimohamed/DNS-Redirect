/**
 * Database layer — Supabase PostgreSQL via `postgres` package.
 *
 * Uses DIRECT_DATABASE_URL (the pooled Supabase Postgres connection string).
 * Falls back to an in-memory store when the env var is absent so local dev
 * without a DB connection still works.
 *
 * The exported `db` object exposes the same interface as before; no callers
 * need to change.
 */

import { User, UserSession, WifiSession, CoffeeShop, WifiGatewayInfo, UserActivityLog } from '@/types';

// ─── Supabase / Postgres client ───────────────────────────────────────────────

let sql: ReturnType<typeof import('postgres')> | null = null;

function getClient() {
  if (sql) return sql;
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url) {
    console.warn('[db] DIRECT_DATABASE_URL not set — using in-memory fallback');
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const postgres = require('postgres') as typeof import('postgres');
  sql = postgres(url, {
    ssl: 'require',
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
  });
  return sql;
}

// ─── In-memory fallback (no DB configured) ───────────────────────────────────

const memoryUsers: Map<string, User> = new Map();
const memoryUserSessions: Map<string, UserSession> = new Map();
const memoryWifiSessions: Map<string, WifiSession> = new Map();
const memoryActivityLogs: Map<string, UserActivityLog> = new Map();

// ─── Static defaults ─────────────────────────────────────────────────────────

export const DEFAULT_COFFEE_SHOP: CoffeeShop = {
  id: 'gw-location-001',
  name: 'Guest Wi-Fi Network',
  slug: 'guest-wifi',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_GATEWAY: WifiGatewayInfo = {
  id: 'gw-001-default',
  coffeeShopId: 'gw-location-001',
  name: 'Main Lounge AP',
  identifier: 'gateway_001',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Helper: map DB row → User ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    displayName: row.display_name ?? row.email.split('@')[0],
    status: row.status ?? 'active',
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

// ─── Helper: map DB row → UserSession ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSession(row: any): UserSession {
  return {
    id: row.id,
    userId: row.user_id,
    sessionTokenHash: row.session_token_hash,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at,
    revokedAt: row.revoked_at
      ? row.revoked_at instanceof Date
        ? row.revoked_at.toISOString()
        : row.revoked_at
      : undefined,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
  };
}

// ─── DB interface ─────────────────────────────────────────────────────────────

export const db = {
  users: {
    async findByEmail(email: string): Promise<User | null> {
      const normalized = email.trim().toLowerCase();
      const client = getClient();

      if (client) {
        const rows = await client<User[]>`
          SELECT * FROM users WHERE email = ${normalized} LIMIT 1
        `;
        return rows.length ? rowToUser(rows[0]) : null;
      }

      for (const user of memoryUsers.values()) {
        if (user.email.toLowerCase() === normalized) return user;
      }
      return null;
    },

    async findById(id: string): Promise<User | null> {
      const client = getClient();

      if (client) {
        const rows = await client<User[]>`
          SELECT * FROM users WHERE id = ${id} LIMIT 1
        `;
        return rows.length ? rowToUser(rows[0]) : null;
      }

      return memoryUsers.get(id) ?? null;
    },

    async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<User> {
      const normalized = data.email.trim().toLowerCase();
      const client = getClient();

      if (client) {
        const rows = await client<User[]>`
          INSERT INTO users (email, password, display_name)
          VALUES (${normalized}, ${data.password}, ${data.displayName ?? normalized.split('@')[0]})
          RETURNING *
        `;
        return rowToUser(rows[0]);
      }

      const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const user: User = {
        ...data,
        id,
        email: normalized,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      memoryUsers.set(id, user);
      return user;
    },
  },

  userSessions: {
    async create(data: Omit<UserSession, 'id' | 'createdAt'>): Promise<UserSession> {
      const client = getClient();

      if (client) {
        const rows = await client<UserSession[]>`
          INSERT INTO user_sessions
            (user_id, session_token_hash, expires_at, ip_address, user_agent)
          VALUES (
            ${data.userId},
            ${data.sessionTokenHash},
            ${data.expiresAt},
            ${data.ipAddress ?? null},
            ${data.userAgent ?? null}
          )
          RETURNING *
        `;
        return rowToSession(rows[0]);
      }

      const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const session: UserSession = { ...data, id, createdAt: new Date().toISOString() };
      memoryUserSessions.set(id, session);
      return session;
    },

    async findByTokenHash(tokenHash: string): Promise<UserSession | null> {
      const client = getClient();

      if (client) {
        const rows = await client<UserSession[]>`
          SELECT * FROM user_sessions
          WHERE session_token_hash = ${tokenHash}
            AND revoked_at IS NULL
            AND expires_at > NOW()
          LIMIT 1
        `;
        return rows.length ? rowToSession(rows[0]) : null;
      }

      for (const session of memoryUserSessions.values()) {
        if (
          session.sessionTokenHash === tokenHash &&
          !session.revokedAt &&
          new Date(session.expiresAt) > new Date()
        ) {
          return session;
        }
      }
      return null;
    },

    async revoke(sessionId: string): Promise<void> {
      const client = getClient();

      if (client) {
        await client`
          UPDATE user_sessions SET revoked_at = NOW() WHERE id = ${sessionId}
        `;
        return;
      }

      const session = memoryUserSessions.get(sessionId);
      if (session) session.revokedAt = new Date().toISOString();
    },
  },

  wifiSessions: {
    async create(data: Omit<WifiSession, 'id' | 'startedAt' | 'status'>): Promise<WifiSession> {
      const client = getClient();

      if (client) {
        // Use the seeded default gateway UUID from schema.sql
        const gatewayId = '00000000-0000-0000-0000-000000000002';
        const rows = await client<Record<string, unknown>[]>`
          INSERT INTO wifi_sessions
            (user_id, gateway_id, client_identifier, ip_address, expires_at)
          VALUES (
            ${data.userId},
            ${gatewayId},
            ${data.clientIdentifier},
            ${data.ipAddress ?? null},
            ${data.expiresAt}
          )
          RETURNING *
        `;
        const row = rows[0];
        return {
          id: row.id as string,
          userId: row.user_id as string,
          gatewayId: row.gateway_id as string,
          clientIdentifier: row.client_identifier as string,
          ipAddress: (row.ip_address as string | null) ?? undefined,
          startedAt: row.started_at instanceof Date
            ? (row.started_at as Date).toISOString()
            : row.started_at as string,
          expiresAt: row.expires_at instanceof Date
            ? (row.expires_at as Date).toISOString()
            : row.expires_at as string,
          status: 'active',
        };
      }

      const id = `wsess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const wifiSession: WifiSession = {
        ...data, id, startedAt: new Date().toISOString(), status: 'active',
      };
      memoryWifiSessions.set(id, wifiSession);
      return wifiSession;
    },

    async findActiveByUserId(userId: string): Promise<WifiSession | null> {
      const client = getClient();

      if (client) {
        const rows = await client<Record<string, unknown>[]>`
          SELECT * FROM wifi_sessions
          WHERE user_id = ${userId}
            AND status = 'active'
            AND expires_at > NOW()
          LIMIT 1
        `;
        if (!rows.length) return null;
        const row = rows[0];
        return {
          id: row.id as string,
          userId: row.user_id as string,
          gatewayId: row.gateway_id as string,
          clientIdentifier: row.client_identifier as string,
          ipAddress: (row.ip_address as string | null) ?? undefined,
          startedAt: row.started_at instanceof Date
            ? (row.started_at as Date).toISOString()
            : row.started_at as string,
          expiresAt: row.expires_at instanceof Date
            ? (row.expires_at as Date).toISOString()
            : row.expires_at as string,
          status: 'active',
        };
      }

      for (const session of memoryWifiSessions.values()) {
        if (session.userId === userId && session.status === 'active') {
          if (new Date(session.expiresAt) > new Date()) return session;
        }
      }
      return null;
    },
  },

  userActivityLogs: {
    async create(data: {
      userId?: string | null;
      clientIp: string;
      clientMac?: string | null;
      domainRequested: string;
    }): Promise<UserActivityLog> {
      const client = getClient();

      if (client) {
        const rows = await client<Record<string, unknown>[]>`
          INSERT INTO user_activity_logs (
            user_id, client_ip, client_mac, domain_requested
          ) VALUES (
            ${data.userId ?? null}, ${data.clientIp}, ${data.clientMac ?? null}, ${data.domainRequested}
          )
          RETURNING *
        `;
        const row = rows[0];
        return {
          id: row.id as string,
          userId: (row.user_id as string | null) ?? undefined,
          clientIp: row.client_ip as string,
          clientMac: (row.client_mac as string | null) ?? undefined,
          domainRequested: row.domain_requested as string,
          createdAt: row.created_at instanceof Date
            ? (row.created_at as Date).toISOString()
            : row.created_at as string,
        };
      }

      const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const logEntry: UserActivityLog = {
        id,
        userId: data.userId ?? null,
        clientIp: data.clientIp,
        clientMac: data.clientMac ?? null,
        domainRequested: data.domainRequested,
        createdAt: new Date().toISOString(),
      };
      memoryActivityLogs.set(id, logEntry);
      return logEntry;
    },
  },
};



