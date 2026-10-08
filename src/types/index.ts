export type UserStatus = 'active' | 'suspended' | 'deleted';
export type GatewayStatus = 'active' | 'offline' | 'disabled';
export type WifiSessionStatus = 'active' | 'expired' | 'revoked' | 'ended';

export interface User {
  id: string;
  email: string;
  password: string; // Plaintext per project specification override
  displayName?: string | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  status: UserStatus;
}

export interface UserSession {
  id: string;
  userId: string;
  sessionTokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CoffeeShop {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WifiGatewayInfo {
  id: string;
  coffeeShopId: string;
  name: string;
  identifier: string;
  status: GatewayStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WifiSession {
  id: string;
  userId: string;
  gatewayId: string;
  clientIdentifier: string;
  ipAddress?: string | null;
  startedAt: string;
  expiresAt: string;
  endedAt?: string | null;
  status: WifiSessionStatus;
}

export interface AuthorizeClientInput {
  gatewayId: string;
  gatewaySessionToken: string; // openNDS FAS tok parameter
  clientMac: string;
  clientIp: string;
  durationMinutes: number;
  userId: string;
}

export interface AuthorizationResult {
  success: boolean;
  redirectUrl?: string;
  error?: string;
  wifiSessionId?: string;
}

export interface WifiGatewayAdapter {
  authorizeClient(input: AuthorizeClientInput): Promise<AuthorizationResult>;
  revokeClient(gatewayId: string, clientMac: string): Promise<boolean>;
}

export interface UserActivityLog {
  id: string;
  userId?: string | null;
  clientIp: string;
  clientMac?: string | null;
  domainRequested: string;
  createdAt: string;
}

