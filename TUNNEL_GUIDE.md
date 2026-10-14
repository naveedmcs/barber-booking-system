# 🛡️ Secure Mobile Development Tunnel Guide (Port 3000)

This guide documents the temporary, password-protected public tunnel workflow for testing the Barber Booking SaaS platform on mobile devices (iOS Safari & Android Chrome) without code pollution or public internet exposure.

---

## ⚡ Current Live Active Tunnel Session

> [!TIP]
> **Active Session:** The tunnel is currently running and verified accessible. Use the links below for immediate mobile testing and demonstration.

| Destination | Direct Link | Authentication Method |
| :--- | :--- | :--- |
| **✨ 1-Tap Mobile Booking Funnel** | [⚡ Open Customer Booking Funnel](https://responsibility-nebraska-math-buffer.trycloudflare.com/booking/?slug=golden-scissors&auth=BarberDev2026!) | **Zero Typing Needed** (Auto-authenticates & stores cookie) |
| **Direct Customer Booking** | [`booking/?slug=golden-scissors`](https://responsibility-nebraska-math-buffer.trycloudflare.com/booking/?slug=golden-scissors) | Enter credentials via browser popup or on-screen form |
| **Salon Owner Portal** | [`portal/index.html`](https://responsibility-nebraska-math-buffer.trycloudflare.com/portal/index.html) | Protected by Gate + Salon Owner JWT session |
| **Super Admin Portal** | [`admin.html`](https://responsibility-nebraska-math-buffer.trycloudflare.com/admin.html) | Protected by Gate + Admin Session |
| **Base Public URL** | [`https://responsibility-nebraska-math-buffer.trycloudflare.com`](https://responsibility-nebraska-math-buffer.trycloudflare.com) | HTTP Basic Auth Gate |

### 🔐 Active Credentials
- **Username:** `admin` *(or `Admin` or `TUNNEL_USER`)*
- **Password:** `BarberDev2026!` *(or `TUNNEL_PASS`)*
- **Session Cookie:** `barber_tunnel_auth=1` (valid 24h, automatically retained across navigation)

---

## 1. Prerequisites (One-Line CLI Installation)

The tunnel can use either **Cloudflare Tunnel** (recommended: zero account needed, free, unlimited bandwidth) or **ngrok**.

### Option A: Cloudflare Tunnel (*Recommended & Pre-Installed*)
If you need to install or update on macOS via Homebrew:
```bash
brew install cloudflared
```

### Option B: ngrok (*Alternative*)
If you prefer ngrok (requires an ngrok account):
```bash
brew install --cask ngrok
```

---

## 2. How to Start the Tunnel

Ensure your local development server is running on port 3000 (`cd frontend && npm run serve`).

Launch the secure tunnel with default credentials:
```bash
./scripts/tunnel.sh
```

### Custom Credentials & Ports
You can customize the username, password, and port directly via CLI flags:
```bash
./scripts/tunnel.sh --user "developer" --pass "MyStrongSecret2026!" --port 3000
```
Or via environment variables:
```bash
TUNNEL_USER="developer" TUNNEL_PASS="MyStrongSecret2026!" ./scripts/tunnel.sh
```

### Specific Provider Flags
- Force Cloudflare Quick Tunnel:
  ```bash
  ./scripts/tunnel.sh --cloudflared
  ```
- Force ngrok Tunnel (with `--basic-auth`):
  ```bash
  ./scripts/tunnel.sh --ngrok
  ```

---

## 3. How to Test on Mobile Devices

When `./scripts/tunnel.sh` launches, it outputs a secure session banner:

```text
=================================================================
  🎉 SECURE PUBLIC TUNNEL ACTIVE
=================================================================
  Public URL:       https://<random-subdomain>.trycloudflare.com
  Direct Booking:   https://<random-subdomain>.trycloudflare.com/booking/?slug=golden-scissors
  Salon Portal:     https://<random-subdomain>.trycloudflare.com/portal/index.html

  ✨ 1-TAP INSTANT ACCESS LINK (Zero Typing Needed):
  https://<random-subdomain>.trycloudflare.com/booking/?slug=golden-scissors&auth=BarberDev2026!

  Accepted Credentials (HTTP Basic Auth or Web Form):
    Username:       admin  (or TUNNEL_USER)
    Password:       BarberDev2026!  (or TUNNEL_PASS)
=================================================================
```

### Steps to Access:
1. **Option 1: ⚡ 1-Tap Magic Link (Zero Typing Needed)**
   - Open the link with `&auth=BarberDev2026!`.
   - Your session is authenticated immediately via cookie and the mobile booking funnel opens without any prompt.
2. **Option 2: On-Screen Web Form**
   - If your mobile browser blocks the native basic auth dialog or you cancel it, an interactive dark-mode unlock form is displayed on the screen.
   - Enter `admin` / `BarberDev2026!` (or tap "⚡ 1-Tap Instant Unlock") to enter.
3. **Option 3: Browser Basic Auth Dialog**
   - Enter **Username:** `admin` (case-insensitive, e.g. `Admin`)
   - Enter **Password:** `BarberDev2026!`
4. **Security Verification:** Any external web crawler or user without valid credentials receives `HTTP 401 Unauthorized` and is immediately rejected.

---

## 4. How to Stop the Tunnel

To immediately terminate the tunnel and revert to local-only access:

1. In the terminal window running `./scripts/tunnel.sh`, press:
   ```text
   Ctrl + C
   ```
2. The script gracefully catches the signal, shuts down the tunnel connection, frees the authentication gate, and displays:
   ```text
   [OK] Tunnel successfully stopped. Port 3000 is back to private local-only.
   ```
3. Your local development server remains active and completely untouched on `http://localhost:3000`.

---

## 5. Complete Cleanup / Removal Guide (Zero Residuals)

When mobile testing is finished and you want to remove all traces of this setup:

### Step 1: Remove Tunnel Script and Documentation
Run from the project root:
```bash
rm -f scripts/tunnel.sh TUNNEL_GUIDE.md
```

### Step 2: Uninstall CLI Binary (Optional)
If you installed `cloudflared` or `ngrok` solely for this sprint and wish to remove the binary:
```bash
brew uninstall cloudflared
# or if using ngrok:
brew uninstall --cask ngrok
```

After these two steps, the Git workspace has zero residual files and zero configuration drift.
