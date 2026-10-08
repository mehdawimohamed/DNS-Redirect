-- ====================================================================
-- PostgreSQL Schema Migration — Wi-Fi Authentication Platform
-- Supabase / PostgreSQL compatible
-- ====================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- Plaintext per project specification override
  display_name TEXT,
  email_verified_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. User Sessions Table (Application Web Sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);

-- 4. Coffee Shops / Locations Table
CREATE TABLE IF NOT EXISTS coffee_shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 5. Wi-Fi Gateways Table
CREATE TABLE IF NOT EXISTS wifi_gateways (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coffee_shop_id UUID NOT NULL REFERENCES coffee_shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  identifier TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'offline', 'disabled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 6. Wi-Fi Sessions Table (Active Internet Grants)
CREATE TABLE IF NOT EXISTS wifi_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gateway_id UUID NOT NULL REFERENCES wifi_gateways(id) ON DELETE CASCADE,
  client_identifier TEXT NOT NULL, -- MAC Address or Client Identifier
  ip_address INET NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'ended'))
);

-- 7. User Activity Logs Table (DNS / Domain Requests)
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  client_ip VARCHAR(45) NOT NULL,
  client_mac VARCHAR(17) NULL,
  domain_requested VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for fast user activity lookups
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_wifi_sessions_user ON wifi_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_wifi_sessions_gateway ON wifi_sessions(gateway_id);
CREATE INDEX IF NOT EXISTS idx_wifi_sessions_client ON wifi_sessions(client_identifier);

-- 7. Seed Initial Default Location & Gateway
INSERT INTO coffee_shops (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Guest Wi-Fi Network', 'guest-wifi')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO wifi_gateways (id, coffee_shop_id, name, identifier)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Main Lounge AP', 'gateway_001')
ON CONFLICT (identifier) DO NOTHING;
