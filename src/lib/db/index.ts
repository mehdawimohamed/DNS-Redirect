import { User, UserSession, WifiSession, CoffeeShop, WifiGatewayInfo } from '@/types';

// In-memory fallback store for local development / testing before Supabase connection
const memoryUsers: Map<string, User> = new Map();
const memoryUserSessions: Map<string, UserSession> = new Map();
const memoryWifiSessions: Map<string, WifiSession> = new Map();

// Default Wi-Fi Network & Gateway definitions
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

export const db = {
  users: {
    async findByEmail(email: string): Promise<User | null> {
      const normalized = email.trim().toLowerCase();
      for (const user of memoryUsers.values()) {
        if (user.email.toLowerCase() === normalized) {
          return user;
        }
      }
      return null;
    },

    async findById(id: string): Promise<User | null> {
      return memoryUsers.get(id) || null;
    },

    async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<User> {
      const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const user: User = {
        ...data,
        id,
        email: data.email.trim().toLowerCase(),
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
      const id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const session: UserSession = {
        ...data,
        id,
        createdAt: new Date().toISOString(),
      };
      memoryUserSessions.set(id, session);
      return session;
    },

    async findByTokenHash(tokenHash: string): Promise<UserSession | null> {
      for (const session of memoryUserSessions.values()) {
        if (session.sessionTokenHash === tokenHash && !session.revokedAt) {
          if (new Date(session.expiresAt) > new Date()) {
            return session;
          }
        }
      }
      return null;
    },

    async revoke(sessionId: string): Promise<void> {
      const session = memoryUserSessions.get(sessionId);
      if (session) {
        session.revokedAt = new Date().toISOString();
      }
    },
  },

  wifiSessions: {
    async create(data: Omit<WifiSession, 'id' | 'startedAt' | 'status'>): Promise<WifiSession> {
      const id = `wsess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const wifiSession: WifiSession = {
        ...data,
        id,
        startedAt: new Date().toISOString(),
        status: 'active',
      };
      memoryWifiSessions.set(id, wifiSession);
      return wifiSession;
    },

    async findActiveByUserId(userId: string): Promise<WifiSession | null> {
      for (const session of memoryWifiSessions.values()) {
        if (session.userId === userId && session.status === 'active') {
          if (new Date(session.expiresAt) > new Date()) {
            return session;
          }
        }
      }
      return null;
    },
  },
};
