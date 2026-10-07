# Coffee Shop Wi-Fi Authentication Platform
## Comprehensive Technical Specification — MVP

**Document version:** 1.0  
**Status:** Development Specification  
**Primary objective:** Provide Internet access to coffee-shop customers only after they authenticate through the coffee shop's platform.

---

# 1. Product Overview

Build a coffee-shop Wi-Fi authentication platform that allows customers to:

1. Connect to the coffee shop's Wi-Fi network.
2. Automatically encounter a captive portal when they attempt to access the Internet.
3. Create an account or log into an existing account.
4. Become authorized for Internet access after successful authentication.
5. Browse the Internet normally after authorization.

The platform MUST NOT:

- Redirect authenticated customers to the coffee shop website.
- Intercept or proxy customers' HTTPS traffic.
- Modify arbitrary third-party website content.
- Perform HTTPS man-in-the-middle interception.
- Act as a general-purpose DNS hijacking system.
- Require the customer's password to be transmitted to the Wi-Fi gateway.

The Wi-Fi gateway is responsible for network access control.

The Next.js application is responsible for identity, authentication, user management, and communicating authorization decisions to the gateway.

---

# 2. High-Level Architecture

```text
                         INTERNET
                            │
                            │
                    ┌───────▼────────┐
                    │  Wi-Fi Gateway  │
                    │                 │
                    │    OpenWrt      │
                    │    openNDS      │
                    │    Firewall     │
                    │    DHCP / DNS   │
                    └───────┬─────────┘
                            │
                       Guest Wi-Fi
                            │
              ┌─────────────┼─────────────┐
              │             │             │
            Phone         Phone         Laptop
              │             │             │
              └─────────────┼─────────────┘
                            │
                     Captive Portal
                            │
                            ▼
                  ┌──────────────────┐
                  │    Next.js App   │
                  │                  │
                  │ Login / Signup   │
                  │ Custom Auth      │
                  │ User Account     │
                  │ Wi-Fi API        │
                  └────────┬─────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │ Supabase         │
                  │ PostgreSQL       │
                  │                  │
                  │ Users            │
                  │ Sessions         │
                  │ Wi-Fi sessions   │
                  │ Gateways         │
                  └──────────────────┘

                  Optional:
                  Cloudflare R2
                  for object storage
```

---

# 3. Technology Stack

## Frontend / Full-stack Application

Use:

- Next.js
- React
- TypeScript
- App Router
- React Hook Form
- Conform
- Zod
- TanStack Query
- Zustand
- nuqs
- Lucide React
- React Icons
- shadcn/ui
- useDebounce
- nextjs-toploader
- prettier-plugin-tailwindcss
- `ianvs/prettier-plugin-sort-imports`
- Framer Motion
- tailwindcss-animate
- Custom authentication
- dnd-kit

## Database

Use:

- Supabase
- PostgreSQL

Supabase should primarily provide the PostgreSQL database.

Do not automatically introduce Supabase Auth because the application uses custom authentication.

## Object Storage

Optional:

- Cloudflare R2

Use R2 only for files that genuinely require object storage, such as:

- Coffee-shop logos
- User avatars
- Promotional images
- Menu images
- Future campaign assets

Do not use R2 for relational application data.

## Network

Initial target:

- OpenWrt
- openNDS
- Gateway firewall
- DHCP
- DNS

The exact router/access-point hardware will be selected separately.

---

# 4. Core User Journey

## New Customer

```text
Customer
   │
   ▼
Connects to CoffeeShop Wi-Fi
   │
   ▼
Device receives IP address via DHCP
   │
   ▼
Customer attempts Internet access
   │
   ▼
Captive portal detected
   │
   ▼
Login / Signup page
   │
   ▼
Create account
   │
   ▼
Authentication succeeds
   │
   ▼
Wi-Fi authorization request
   │
   ▼
Gateway authorizes client
   │
   ▼
Internet access
```

## Existing Customer

```text
Connect Wi-Fi
     ↓
Captive portal
     ↓
Login
     ↓
Authentication
     ↓
Gateway authorization
     ↓
Internet access
```

## Authenticated Customer

The customer should be able to browse the Internet normally.

The system must NOT redirect normal browsing traffic through the application.

---

# 5. Authentication Requirements

Implement custom authentication.

## Registration

Minimum fields:

- Email
- Password
- Display name

Optional fields can be added later.

Registration requirements:

- Validate all fields with Zod.
- Normalize email addresses.
- Passwords MUST never be stored in plaintext.
- Use Argon2id for password hashing.
- Prevent duplicate accounts.
- Apply registration rate limiting.
- Return generic errors where necessary to avoid unnecessary account enumeration.

## Login

Requirements:

- Email/password authentication.
- Secure server-side session.
- HTTP-only session cookie.
- Secure cookie in production.
- SameSite protection.
- Session expiration.
- Session revocation.
- Login rate limiting.
- Failed-login tracking where appropriate.

## Password reset

Implement:

```text
Forgot password
      ↓
Email verification token
      ↓
Reset password
      ↓
Invalidate appropriate old sessions
```

Tokens must:

- Be cryptographically random.
- Have short expiration.
- Be single-use.
- Never be stored in plaintext if persisted.

---

# 6. Session Architecture

Separate application sessions from Wi-Fi sessions.

## Application Session

Represents:

> "This browser is authenticated as this user."

Example:

```text
user_session
- id
- user_id
- created_at
- expires_at
- revoked_at
```

## Wi-Fi Session

Represents:

> "This particular network client is authorized to access the Internet."

Example:

```text
wifi_session
- id
- user_id
- gateway_id
- client_identifier
- ip_address
- started_at
- expires_at
- revoked_at
- status
```

Do NOT assume an application login automatically equals permanent Wi-Fi authorization.

---

# 7. Wi-Fi Authorization Architecture

The gateway controls actual Internet access.

The web application does not directly route customer traffic.

Conceptually:

```text
Unauthenticated client
        │
        ▼
Gateway
        │
        ├── Authentication infrastructure → ALLOWED
        │
        └── Internet → BLOCKED
```

After successful authentication:

```text
Authenticated client
        │
        ▼
Gateway
        │
        └── Internet → ALLOWED
```

Authorization should be temporary and represented by a Wi-Fi session.

Example:

```text
Wi-Fi session duration:
4 hours
```

This value must be configurable.

---

# 8. Captive Portal

The captive portal is responsible for presenting the authentication UI.

Use openNDS as the initial captive-portal mechanism.

The captive portal should:

1. Detect unauthenticated clients.
2. Present the authentication application.
3. Preserve the network client's session context.
4. Allow login/registration.
5. Notify the backend after successful authentication.
6. Allow the gateway to authorize the client.
7. Return the user to normal Internet access.

The portal MUST NOT require interception of HTTPS traffic.

---

# 9. Captive Portal Authentication Flow

The gateway should provide the application with the necessary client/session context.

Example conceptual request:

```text
https://app.example.com/wifi/login
    ?gateway_session=<opaque-session-id>
```

Do not trust arbitrary query parameters as proof of identity.

The application must verify that the session context originated from a trusted gateway.

After successful login:

```text
POST /api/wifi/authorize
```

Example conceptual payload:

```json
{
  "gatewayId": "gateway_001",
  "gatewaySession": "opaque-session-token"
}
```

The backend validates the gateway/session and creates a Wi-Fi authorization.

The gateway then changes the client state from:

```text
UNAUTHORIZED
```

to:

```text
AUTHORIZED
```

---

# 10. Gateway Trust Model

Never expose a powerful gateway API publicly without authentication.

Gateway communication should use one of:

- Private network communication
- Mutual authentication
- Signed requests
- Short-lived authorization tokens
- API keys stored securely
- VPN/private tunnel

The preferred production architecture should minimize publicly exposed gateway management endpoints.

The Next.js application must not expose router credentials to the browser.

Architecture:

```text
Browser
   │
   ▼
Next.js
   │
   ▼
Trusted gateway-control channel
   │
   ▼
OpenWrt
```

NOT:

```text
Browser
   │
   ▼
OpenWrt admin API
```

---

# 11. Database Schema

## users

```text
id UUID PRIMARY KEY
email TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
display_name TEXT
email_verified_at TIMESTAMP NULL
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
status TEXT NOT NULL
```

Possible status values:

```text
active
suspended
deleted
```

---

## user_sessions

```text
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
session_token_hash TEXT
created_at TIMESTAMP
expires_at TIMESTAMP
revoked_at TIMESTAMP NULL
ip_address TEXT NULL
user_agent TEXT NULL
```

---

## coffee_shops

```text
id UUID PRIMARY KEY
name TEXT NOT NULL
slug TEXT UNIQUE NOT NULL
status TEXT NOT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

---

## wifi_gateways

```text
id UUID PRIMARY KEY
coffee_shop_id UUID REFERENCES coffee_shops(id)
name TEXT NOT NULL
identifier TEXT UNIQUE NOT NULL
status TEXT NOT NULL
created_at TIMESTAMP
updated_at TIMESTAMP
```

Possible status:

```text
active
offline
disabled
```

---

## wifi_sessions

```text
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
gateway_id UUID REFERENCES wifi_gateways(id)
client_identifier TEXT NOT NULL
ip_address INET NULL
started_at TIMESTAMP NOT NULL
expires_at TIMESTAMP NOT NULL
ended_at TIMESTAMP NULL
status TEXT NOT NULL
```

Possible status:

```text
active
expired
revoked
ended
```

---

## password_reset_tokens

```text
id UUID PRIMARY KEY
user_id UUID REFERENCES users(id)
token_hash TEXT NOT NULL
expires_at TIMESTAMP NOT NULL
used_at TIMESTAMP NULL
created_at TIMESTAMP NOT NULL
```

---

# 12. Row-Level Security

Supabase PostgreSQL should use appropriate Row-Level Security policies.

Never expose unrestricted service credentials to the browser.

The frontend must never receive:

- Supabase service-role key
- Gateway credentials
- Database credentials
- Internal API secrets

Server-only secrets belong in environment variables.

---

# 13. API Architecture

Use Next.js Route Handlers for the initial API.

Example structure:

```text
app/
├── api/
│   ├── auth/
│   │   ├── register/
│   │   ├── login/
│   │   ├── logout/
│   │   ├── session/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   │
│   └── wifi/
│       ├── authorize/
│       ├── session/
│       └── logout/
```

Admin APIs should be separated:

```text
api/admin/
```

---

# 14. Frontend Routes

Initial routes:

```text
/
```

Landing page.

```text
/login
```

Customer login.

```text
/register
```

Customer registration.

```text
/forgot-password
```

Password recovery.

```text
/reset-password
```

Password reset.

```text
/wifi
```

Wi-Fi authentication/captive portal entry point.

```text
/account
```

Customer account.

```text
/account/sessions
```

Active/recent sessions.

Potential future routes:

```text
/admin
/admin/users
/admin/wifi
/admin/gateways
/admin/sessions
/admin/analytics
```

---

# 15. Frontend State Architecture

Use each state library for a specific purpose.

## React Hook Form

Use for:

- Login
- Registration
- Password reset
- Account forms
- Admin forms

## Conform

Use where server-oriented form handling provides value.

Avoid duplicating the same form state between Conform and React Hook Form unnecessarily.

## Zod

Use as the validation source of truth.

Validation schemas should be reusable on the server and client where appropriate.

Example:

```text
schemas/
├── auth.ts
├── user.ts
├── wifi.ts
└── admin.ts
```

## TanStack Query

Use for server state:

- Current user
- Wi-Fi session
- Account information
- Admin users
- Gateway status
- Analytics

Do not use Zustand to duplicate TanStack Query server state.

## Zustand

Use for lightweight client-only state.

Examples:

- UI preferences
- Modal state
- Temporary client state
- Captive portal UI state

## nuqs

Use for URL state:

```text
/admin/users?search=john
/admin/users?page=2
```

---

# 16. UI

Use:

- shadcn/ui
- Tailwind CSS
- Lucide React as the primary icon library
- React Icons only where Lucide does not provide an appropriate icon
- Framer Motion for meaningful transitions
- tailwindcss-animate

The authentication interface should be:

- Mobile-first
- Extremely fast
- Accessible
- Simple
- Optimized for customers using phones
- Usable inside captive-portal browser environments

Avoid heavy animations on the authentication screen.

---

# 17. Captive Portal UX

The authentication page should work well when launched by:

- Android captive portal browser
- iOS captive portal browser
- Windows captive portal detection
- macOS captive portal detection
- Normal mobile browsers

The UI should not depend on:

- local storage being available
- third-party cookies
- complex browser APIs
- JavaScript-only authentication
- popups

The authentication process should work with a minimal browser environment.

---

# 18. Network Requirements

Create a dedicated guest network.

Example:

```text
VLAN 20
SSID: CoffeeShop WiFi
```

Staff/internal systems should NOT share the same network.

Recommended:

```text
VLAN 10 → Staff
VLAN 20 → Customers
VLAN 30 → Network management
```

Customers should be isolated from:

- Router administration
- Staff devices
- POS systems
- Printers where possible
- Internal servers
- Other customer devices where appropriate

Client isolation should be enabled where supported.

---

# 19. Firewall Requirements

Default guest policy:

```text
Guest → Internet          ALLOW after authentication
Guest → Gateway           Restricted
Guest → Staff VLAN        DENY
Guest → Management VLAN   DENY
Guest → Other clients     DENY where appropriate
```

Unauthenticated clients:

```text
DNS                     ALLOW
Captive portal          ALLOW
Authentication backend  ALLOW
Internet                DENY
```

Authenticated clients:

```text
Internet                ALLOW
Internal networks       DENY
Gateway administration  DENY
```

---

# 20. DNS

DNS is used normally for network resolution.

Do NOT use DNS as the primary authentication mechanism.

Do NOT implement:

```text
*.google.com → coffee-shop-IP
*.youtube.com → coffee-shop-IP
```

The captive portal/gateway is responsible for access control.

DNS should remain a normal resolver for authenticated clients.

---

# 21. HTTPS

The production application MUST use HTTPS.

Example:

```text
https://wifi.example.com
```

The captive portal should ultimately communicate with the secure application.

Do not perform HTTPS interception.

Do not install custom CA certificates on customer devices.

Do not attempt to decrypt customer traffic.

---

# 22. Security Requirements

Implement:

### Authentication

- Argon2id password hashing
- Secure cookies
- Session expiration
- Session revocation
- Password reset
- Email verification if enabled
- Login throttling

### API

- Zod validation
- Authentication middleware
- Authorization middleware
- Rate limiting
- CSRF protection where applicable
- Request size limits
- Strict CORS configuration
- Input sanitization where relevant

### Network

- Guest network isolation
- Firewall rules
- Gateway administration inaccessible to guests
- Gateway credentials never exposed to clients

### Secrets

Never commit:

```text
.env
.env.local
credentials
API keys
gateway secrets
database passwords
```

Use environment variables and deployment secret management.

---

# 23. Rate Limiting

Rate-limit at minimum:

```text
POST /api/auth/login
POST /api/auth/register
POST /api/auth/forgot-password
POST /api/auth/reset-password
POST /api/wifi/authorize
```

Rate limits should be applied using a combination of:

- IP
- Account identifier where appropriate
- Gateway/client context

Do not make rate limits so aggressive that an entire coffee shop sharing an external IP gets locked out.

---

# 24. Logging

Log security-relevant events.

Examples:

```text
USER_REGISTERED
USER_LOGIN_SUCCESS
USER_LOGIN_FAILED
USER_LOGOUT
PASSWORD_RESET_REQUESTED
PASSWORD_RESET_COMPLETED

WIFI_SESSION_CREATED
WIFI_SESSION_EXPIRED
WIFI_SESSION_REVOKED

GATEWAY_CONNECTED
GATEWAY_DISCONNECTED
GATEWAY_AUTHORIZATION_FAILED
```

Do not log:

- Passwords
- Session tokens
- Reset tokens
- Gateway secrets
- Sensitive authentication credentials

---

# 25. Privacy

Only collect information necessary for the product.

Initially:

```text
Email
Display name
Authentication metadata
Wi-Fi session metadata
```

Avoid unnecessarily storing browsing history.

The system should NOT inspect or store the customer's Internet traffic.

Do not implement URL-level browsing surveillance as part of this MVP.

---

# 26. Wi-Fi Session Rules

Make session behavior configurable.

Example configuration:

```text
DEFAULT_WIFI_SESSION_DURATION=4h
MAX_DEVICES_PER_USER=3
```

Possible future rules:

```text
One active session per account
Multiple simultaneous devices
Daily session limit
Unlimited session
Session expires at shop closing
```

For MVP:

**Allow configurable session duration.**

---

# 27. Device Handling

A user may connect multiple devices.

The system should distinguish:

```text
User
  ├── Phone
  ├── Laptop
  └── Tablet
```

Do not permanently identify users based solely on IP address.

The gateway should provide an appropriate client/session identifier.

Treat device identifiers as potentially sensitive and avoid exposing them unnecessarily.

---

# 28. Error States

The UI must handle:

### Authentication

- Invalid credentials
- Account doesn't exist
- Account already exists
- Password too weak
- Rate limited
- Session expired
- Account suspended

### Wi-Fi

- Gateway unavailable
- Authorization failed
- Gateway session expired
- Wi-Fi session expired
- User already authorized
- Maximum devices reached
- Network temporarily unavailable

Example:

> "Your account was verified, but we couldn't activate Wi-Fi access. Please try again."

Do not expose internal gateway errors to customers.

---

# 29. Offline / Failure Behavior

If the Next.js application is unavailable:

- Existing authorized users should ideally continue using the Internet until their gateway session expires.
- New users cannot authenticate.
- Gateway should fail safely.
- Gateway management should remain accessible to administrators through the management network.

Do not make a temporary application outage unnecessarily disconnect every currently authenticated customer.

---

# 30. Admin Dashboard — Future Phase

The architecture should support an admin dashboard.

Potential features:

```text
Dashboard
├── Active customers
├── Active Wi-Fi sessions
├── Total registrations
├── Gateway status
├── Session history
├── User management
├── Coffee-shop management
└── System settings
```

Do not implement all of this in the initial MVP unless needed.

---

# 31. Multi-Location Support

Design the database so that multiple coffee shops can exist.

```text
CoffeeShop
    │
    ├── Gateway A
    ├── Gateway B
    └── Gateway C
```

A future user could visit:

```text
Coffee Shop Tunis
Coffee Shop Sousse
Coffee Shop Sfax
```

and authenticate with the same account.

The MVP can initially contain one coffee-shop location, but the database should not make multi-location expansion impossible.

---

# 32. Environment Variables

Example:

```env
DATABASE_URL=
DIRECT_DATABASE_URL=

AUTH_SECRET=
AUTH_SESSION_DURATION=

APP_URL=

WIFI_GATEWAY_API_URL=
WIFI_GATEWAY_API_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

Never expose server-only variables through `NEXT_PUBLIC_*`.

---

# 33. Project Structure

Recommended initial structure:

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   │
│   ├── wifi/
│   │
│   ├── account/
│   │
│   ├── api/
│   │   ├── auth/
│   │   └── wifi/
│   │
│   └── layout.tsx
│
├── components/
│   ├── ui/
│   ├── auth/
│   ├── wifi/
│   └── account/
│
├── lib/
│   ├── auth/
│   ├── wifi/
│   ├── db/
│   ├── security/
│   └── validation/
│
├── schemas/
│   ├── auth.ts
│   ├── wifi.ts
│   └── user.ts
│
├── hooks/
│
├── stores/
│
├── queries/
│
├── types/
│
└── config/
```

The exact structure may be adjusted by the IDE agent if there is a strong architectural reason.

---

# 34. Development Phases

## Phase 1 — Application Foundation

Build:

- Next.js project
- TypeScript
- Tailwind
- shadcn/ui
- ESLint
- Prettier
- Import sorting
- Environment configuration
- Supabase PostgreSQL connection
- Database migrations

---

## Phase 2 — Authentication

Build:

- Registration
- Login
- Logout
- Session handling
- Password hashing
- Password reset
- Account page
- Auth middleware
- Rate limiting

At this point the application should work independently from Wi-Fi.

---

## Phase 3 — Wi-Fi Session Model

Build:

- Gateways
- Wi-Fi sessions
- Device/client identification
- Session expiration
- Session revocation
- Authorization APIs

Do not connect the physical gateway yet.

Test the complete authorization lifecycle using mocked gateway requests.

---

## Phase 4 — Captive Portal

Install/configure:

- OpenWrt
- openNDS
- Guest SSID
- DHCP
- Firewall
- Captive portal

Connect the portal to the Next.js application.

---

## Phase 5 — Real Authorization

Implement:

```text
Login
  ↓
Backend verifies user
  ↓
Wi-Fi authorization created
  ↓
Gateway receives authorization
  ↓
Client firewall rules change
  ↓
Internet access
```

Test with:

- Android
- iPhone
- Windows laptop
- macOS laptop

---

## Phase 6 — Security Hardening

Perform:

- Authentication testing
- Session testing
- Rate-limit testing
- Gateway isolation testing
- VLAN testing
- Guest-to-staff isolation testing
- Gateway API security testing
- HTTPS testing
- Captive portal testing
- Failure testing

---

# 35. Definition of Done — MVP

The MVP is complete when all of the following work:

### Customer

- [ ] Customer sees the CoffeeShop Wi-Fi network.
- [ ] Customer connects without access to the general Internet.
- [ ] Captive portal appears.
- [ ] Customer can register.
- [ ] Customer can log in.
- [ ] Customer can log out.
- [ ] Customer receives an authenticated Wi-Fi session.
- [ ] Internet access becomes available after authentication.
- [ ] Customer can browse arbitrary HTTPS websites normally.
- [ ] Customer is not redirected while browsing.
- [ ] Customer's traffic is not intercepted.

### Authentication

- [ ] Passwords are securely hashed.
- [ ] Sessions are secure.
- [ ] Password reset works.
- [ ] Rate limiting works.
- [ ] Invalid credentials are handled safely.

### Gateway

- [ ] Unauthenticated clients are blocked.
- [ ] Authenticated clients are allowed.
- [ ] Guest clients cannot access staff networks.
- [ ] Gateway administration is inaccessible to guests.
- [ ] Wi-Fi sessions expire correctly.
- [ ] Revoking a session removes Internet access.

### Application

- [ ] Mobile UI works inside captive portal browsers.
- [ ] API authentication works.
- [ ] Database constraints are enforced.
- [ ] Server secrets are never exposed.
- [ ] Error states are handled cleanly.

---

# 36. Explicit Non-Goals

Do NOT implement these in the MVP:

- HTTPS interception
- Traffic decryption
- DNS hijacking
- Arbitrary website redirection
- Advertising injection
- Browser history collection
- Deep packet inspection
- Social-media traffic tracking
- Paid Wi-Fi
- Loyalty system
- Orders
- POS integration
- Marketing automation
- Multi-tenant billing

These can be evaluated later.

---

# 37. Important Architectural Principle

The system consists of three separate trust domains:

```text
┌───────────────────────────────────────────────┐
│                  CUSTOMER                     │
│                                               │
│ Browser / Device                              │
└──────────────────────┬────────────────────────┘
                       │
                       │ HTTPS
                       ▼
┌───────────────────────────────────────────────┐
│              APPLICATION                      │
│                                               │
│ Next.js                                      │
│ Authentication                               │
│ PostgreSQL                                   │
│ Wi-Fi authorization                          │
└──────────────────────┬────────────────────────┘
                       │
                       │ Trusted control channel
                       ▼
┌───────────────────────────────────────────────┐
│                NETWORK                        │
│                                               │
│ OpenWrt                                      │
│ openNDS                                      │
│ Firewall                                     │
│ DHCP / DNS                                   │
└───────────────────────────────────────────────┘
```

The customer must never directly control the network authorization mechanism.

The browser communicates with the application.

The application communicates with the gateway.

The gateway controls network access.

---

# 38. AI IDE Agent Instructions

When implementing this specification:

1. Do not invent additional infrastructure unless necessary.
2. Keep network-control logic separate from application logic.
3. Do not implement HTTPS interception.
4. Do not implement DNS-based website hijacking.
5. Do not expose gateway credentials to the client.
6. Do not store passwords in plaintext.
7. Do not store authentication tokens unnecessarily.
8. Use Zod for API input validation.
9. Use TypeScript strictly.
10. Prefer server-side authorization checks.
11. Do not duplicate server state in Zustand when TanStack Query should manage it.
12. Keep the application mobile-first.
13. Keep captive-portal pages lightweight.
14. Build the authentication system independently before integrating OpenWrt.
15. Mock the gateway during application development.
16. Write clear interfaces between the application and gateway.
17. Make Wi-Fi session duration configurable.
18. Make the system capable of supporting multiple gateways and coffee-shop locations.
19. Fail securely when authorization cannot be verified.
20. Do not claim the Wi-Fi authorization is complete until the gateway actually confirms it.

---

# 39. Initial Implementation Order

The AI agent should implement in this order:

```text
1. Project setup
       ↓
2. Database schema
       ↓
3. Custom authentication
       ↓
4. Session management
       ↓
5. Login/register UI
       ↓
6. Wi-Fi session database model
       ↓
7. Wi-Fi authorization API
       ↓
8. Mock gateway adapter
       ↓
9. Captive portal UI
       ↓
10. OpenWrt integration
       ↓
11. openNDS integration
       ↓
12. Real gateway authorization
       ↓
13. Security hardening
       ↓
14. Cross-device testing
```

The **gateway adapter should be an abstraction**, for example:

```ts
interface WifiGateway {
  authorizeClient(input: AuthorizeClientInput): Promise<AuthorizationResult>;
  revokeClient(input: RevokeClientInput): Promise<void>;
  getClientSession(input: ClientSessionInput): Promise<ClientSession>;
}
```

This allows development to use:

```text
MockWifiGateway
```

and production to use:

```text
OpenNDSWifiGateway
```

without rewriting the application.

---

# 40. Final MVP Principle

The entire system should ultimately behave like this:

```text
                    CUSTOMER
                       │
                       ▼
               Connects to Wi-Fi
                       │
                       ▼
               ┌──────────────┐
               │   Gateway    │
               └──────┬───────┘
                      │
                Not authorized
                      │
                      ▼
               Captive Portal
                      │
                      ▼
               Next.js / Auth
                      │
                Login / Signup
                      │
                      ▼
                User verified
                      │
                      ▼
             Wi-Fi authorization
                      │
                      ▼
               Gateway confirms
                      │
                      ▼
                INTERNET ACCESS
                      │
                      ▼
            Normal Internet browsing
```

**The customer authenticates once. The gateway enforces access. The application never touches the customer's actual Internet traffic.**
