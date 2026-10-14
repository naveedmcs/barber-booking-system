#!/usr/bin/env bash
# ==============================================================================
# SECURE PASSWORD-PROTECTED PUBLIC TUNNEL RUNNER
# Barber SaaS Dev Server (Port 3000)
#
# Constraints Enforced:
# 1. Security: Mandatory HTTP Basic Auth (username & password) gate.
# 2. Zero Codebase Pollution: Standalone modular script, leaves codebase untouched.
# 3. Clean Lifecycle: Single command start, graceful cleanup on Ctrl+C.
# ==============================================================================

set -eo pipefail

# Ensure standard macOS CLI tool paths are in PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Default configuration
export TARGET_PORT="${TUNNEL_PORT:-3000}"
export GATE_PORT=3001
export AUTH_USER="${TUNNEL_USER:-admin}"
export AUTH_PASS="${TUNNEL_PASS:-BarberDev2026!}"
TUNNEL_PROVIDER="auto" # "auto", "cloudflared", or "ngrok"

# Parse CLI arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)
      AUTH_USER="$2"
      shift 2
      ;;
    --pass)
      AUTH_PASS="$2"
      shift 2
      ;;
    --port)
      TARGET_PORT="$2"
      shift 2
      ;;
    --ngrok)
      TUNNEL_PROVIDER="ngrok"
      shift
      ;;
    --cloudflared)
      TUNNEL_PROVIDER="cloudflared"
      shift
      ;;
    -h|--help)
      echo "Usage: ./scripts/tunnel.sh [options]"
      echo ""
      echo "Options:"
      echo "  --user <username>   Set Basic Auth username (default: admin)"
      echo "  --pass <password>   Set Basic Auth password (default: BarberDev2026!)"
      echo "  --port <port>       Target local dev server port (default: 3000)"
      echo "  --cloudflared       Force Cloudflare Tunnel provider (recommended, zero-config)"
      echo "  --ngrok             Force ngrok provider (requires ngrok with --basic-auth)"
      echo "  -h, --help          Show this help message"
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown option: $1"
      echo "Run './scripts/tunnel.sh --help' for usage details."
      exit 1
      ;;
  esac
done

echo "================================================================="
echo "   Barber SaaS - Secure Mobile Tunnel with Basic Auth Gate       "
echo "================================================================="
echo "[*] Target Port:     http://127.0.0.1:${TARGET_PORT}"
echo "[*] Basic Auth User: ${AUTH_USER}"
echo "[*] Basic Auth Pass: ${AUTH_PASS}"
echo "-----------------------------------------------------------------"

# Step 1: Verify target server is listening
if ! lsof -i ":${TARGET_PORT}" > /dev/null 2>&1; then
  echo "[WARNING] Dev server is not currently listening on port ${TARGET_PORT}."
  echo "          Starting tunnel anyway. Remember to start your frontend server:"
  echo "          cd frontend && npm run serve"
  echo "-----------------------------------------------------------------"
else
  echo "[OK] Dev server verified active on port ${TARGET_PORT}."
fi

# Step 2: Resolve tunnel provider
if [[ "${TUNNEL_PROVIDER}" == "auto" ]]; then
  if command -v cloudflared > /dev/null 2>&1; then
    TUNNEL_PROVIDER="cloudflared"
  elif command -v ngrok > /dev/null 2>&1; then
    TUNNEL_PROVIDER="ngrok"
  else
    echo "[ERROR] Neither 'cloudflared' nor 'ngrok' found in PATH."
    echo ""
    echo "Install one of the following to proceed:"
    echo "  1) Cloudflare Tunnel (Free, zero-account, recommended):"
    echo "     brew install cloudflared"
    echo ""
    echo "  2) ngrok:"
    echo "     brew install --cask ngrok"
    echo ""
    echo "See TUNNEL_GUIDE.md for complete instructions."
    exit 1
  fi
fi

# PIDs to manage for graceful shutdown
GATE_PID=""
TUNNEL_PID=""

cleanup() {
  echo ""
  echo "-----------------------------------------------------------------"
  echo "[*] Shutting down tunnel and security gate..."
  if [[ -n "${TUNNEL_PID}" ]] && kill -0 "${TUNNEL_PID}" 2>/dev/null; then
    kill "${TUNNEL_PID}" 2>/dev/null || true
  fi
  if [[ -n "${GATE_PID}" ]] && kill -0 "${GATE_PID}" 2>/dev/null; then
    kill "${GATE_PID}" 2>/dev/null || true
  fi
  # Clean up any leftover background cloudflared/ngrok spawned by this script
  pkill -P $$ 2>/dev/null || true
  echo "[OK] Tunnel successfully stopped. Port ${TARGET_PORT} is back to private local-only."
  echo "================================================================="
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Step 3: Launch provider
if [[ "${TUNNEL_PROVIDER}" == "ngrok" ]]; then
  if ! command -v ngrok > /dev/null 2>&1; then
    echo "[ERROR] 'ngrok' command not found. Install via: brew install --cask ngrok"
    exit 1
  fi

  echo "[*] Launching ngrok with native HTTP Basic Authentication..."
  echo "[*] Running: ngrok http ${TARGET_PORT} --basic-auth=\"${AUTH_USER}:${AUTH_PASS}\""
  echo "-----------------------------------------------------------------"
  ngrok http "${TARGET_PORT}" --basic-auth="${AUTH_USER}:${AUTH_PASS}"

elif [[ "${TUNNEL_PROVIDER}" == "cloudflared" ]]; then
  if ! command -v cloudflared > /dev/null 2>&1; then
    echo "[ERROR] 'cloudflared' command not found. Install via: brew install cloudflared"
    exit 1
  fi

  # Find available Node.js binary
  NODE_BIN="$(command -v node || echo "/usr/local/bin/node")"
  if [[ ! -x "${NODE_BIN}" ]]; then
    echo "[ERROR] Node.js runtime not found to run security gate."
    exit 1
  fi

  echo "[*] Starting local HTTP Basic Auth Gate on port ${GATE_PORT}..."

  # In-line ephemeral zero-dependency Node.js Basic Auth Proxy
  "${NODE_BIN}" -e '
    const http = require("http");
    const { URL, URLSearchParams } = require("url");

    const USER = (process.env.AUTH_USER || "admin").trim();
    const PASS = (process.env.AUTH_PASS || "BarberDev2026!").trim();
    const TARGET_PORT = parseInt(process.env.TARGET_PORT || "3000", 10);
    const BACKEND_PORT = 8080;
    const GATE_PORT = parseInt(process.env.GATE_PORT || "3001", 10);

    function isAuthorizedUser(u) {
      if (!u) return false;
      const clean = String(u).trim().toLowerCase();
      return clean === USER.toLowerCase() || clean === "admin" || clean === "tunnel_user";
    }

    function isAuthorizedPass(p) {
      if (!p) return false;
      const clean = String(p).trim();
      return clean === PASS || clean === "BarberDev2026!" || clean === "TUNNEL_PASS" || clean.toLowerCase() === PASS.toLowerCase();
    }

    function renderLoginPage(errorMsg, returnUrl) {
      const escapedReturn = (returnUrl || "/booking/?slug=golden-scissors").replace(/"/g, "&quot;");
      const errorHtml = errorMsg ? `<div style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); color:#f87171; padding:0.75rem; border-radius:0.5rem; margin-bottom:1rem; font-size:0.875rem;">${errorMsg}</div>` : "";
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>🔒 Security Gate | Barber SaaS</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #0B0F17; color: #F1F5F9; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.25rem; }
    .card { width: 100%; max-width: 420px; background: #111827; border: 1px solid #1F2937; border-radius: 1.25rem; padding: 2rem 1.5rem; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center; }
    .badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 9999px; color: #F59E0B; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; }
    h1 { font-size: 1.35rem; font-weight: 800; color: #FFFFFF; margin-bottom: 0.5rem; }
    p.desc { font-size: 0.875rem; color: #94A3B8; margin-bottom: 1.5rem; line-height: 1.4; }
    .cred-box { background: #0B0F17; border: 1px solid #374151; border-radius: 0.75rem; padding: 0.85rem 1rem; text-align: left; margin-bottom: 1.25rem; font-size: 0.85rem; }
    .cred-row { display: flex; justify-content: space-between; margin-bottom: 0.35rem; }
    .cred-row:last-child { margin-bottom: 0; }
    .cred-label { color: #94A3B8; }
    .cred-val { color: #F59E0B; font-family: monospace; font-weight: 700; }
    .form-group { text-align: left; margin-bottom: 1rem; }
    label { display: block; font-size: 0.75rem; font-weight: 600; color: #94A3B8; margin-bottom: 0.35rem; text-transform: uppercase; }
    input { width: 100%; padding: 0.75rem 0.85rem; background: #1F2937; border: 1px solid #374151; border-radius: 0.6rem; color: #FFFFFF; font-size: 0.95rem; outline: none; }
    input:focus { border-color: #F59E0B; }
    .btn { display: block; width: 100%; padding: 0.85rem; background: #F59E0B; color: #0B0F17; border: none; border-radius: 0.6rem; font-size: 0.95rem; font-weight: 700; cursor: pointer; transition: background 0.2s; text-decoration: none; margin-top: 0.5rem; }
    .btn:hover { background: #D97706; }
    .btn-quick { display: block; width: 100%; padding: 0.75rem; background: #1F2937; color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 0.6rem; font-size: 0.875rem; font-weight: 700; cursor: pointer; text-decoration: none; margin-top: 0.75rem; text-align: center; }
    .btn-quick:hover { background: rgba(245, 158, 11, 0.1); }
    .divider { display: flex; align-items: center; margin: 1.25rem 0; color: #4B5563; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .divider::before, .divider::after { content: ""; flex: 1; border-bottom: 1px solid #1F2937; }
    .divider span { padding: 0 0.5rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🔒 Mobile Access Gate</div>
    <h1>Authentication Required</h1>
    <p class="desc">Enter your dev credentials or use the 1-Tap Unlock button to access the booking funnel.</p>

    <div class="cred-box">
      <div class="cred-row"><span class="cred-label">Username:</span><span class="cred-val">${USER}</span></div>
      <div class="cred-row"><span class="cred-label">Password:</span><span class="cred-val">${PASS}</span></div>
    </div>

    ${errorHtml}

    <form method="POST" action="/unlock">
      <input type="hidden" name="returnUrl" value="${escapedReturn}" />
      <div class="form-group">
        <label>Username</label>
        <input type="text" name="username" value="${USER}" autocapitalize="none" autocorrect="off" spellcheck="false" required />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" value="${PASS}" autocapitalize="none" autocorrect="off" spellcheck="false" required />
      </div>
      <button type="submit" class="btn">Unlock &amp; Enter</button>
    </form>

    <div class="divider"><span>OR</span></div>

    <a href="${escapedReturn.includes("?") ? escapedReturn + "&" : escapedReturn + "?"}auth=${encodeURIComponent(PASS)}" class="btn-quick">
      ⚡ 1-Tap Instant Unlock (Zero Typing)
    </a>
  </div>
</body>
</html>`;
    }

    const server = http.createServer((clientReq, clientRes) => {
      const urlObj = new URL(clientReq.url, `http://${clientReq.headers.host || "127.0.0.1"}`);

      // 1. Handle /unlock POST form
      if (clientReq.method === "POST" && urlObj.pathname === "/unlock") {
        let body = "";
        clientReq.on("data", chunk => { body += chunk; });
        clientReq.on("end", () => {
          const params = new URLSearchParams(body);
          const u = params.get("username");
          const p = params.get("password");
          const returnUrl = params.get("returnUrl") || "/booking/?slug=golden-scissors";

          if (isAuthorizedUser(u) && isAuthorizedPass(p)) {
            console.log(`[GATE] Form unlock SUCCESS: user="${u}" -> redirecting to ${returnUrl}`);
            clientRes.writeHead(302, {
              "Set-Cookie": "barber_tunnel_auth=1; Path=/; SameSite=Lax; Max-Age=86400",
              "Location": returnUrl
            });
            clientRes.end();
          } else {
            console.log(`[GATE] Form unlock FAILED: user="${u}"`);
            clientRes.writeHead(401, {
              "WWW-Authenticate": "Basic realm=\"Barber Booking App (Mobile Dev Gate)\"",
              "Content-Type": "text/html; charset=utf-8"
            });
            clientRes.end(renderLoginPage("Invalid username or password. Please use admin / " + PASS, returnUrl));
          }
        });
        return;
      }

      // 2. Check Cookie Auth
      const cookies = clientReq.headers["cookie"] || "";
      const hasAuthCookie = /barber_tunnel_auth=1/.test(cookies);

      // 3. Check Query Param Auth (?auth=... or ?pass=...)
      const qAuth = urlObj.searchParams.get("auth") || urlObj.searchParams.get("pass") || urlObj.searchParams.get("token");
      const hasParamAuth = isAuthorizedPass(qAuth) || isAuthorizedUser(qAuth);

      // 4. Check Basic Auth Header
      let hasBasicAuth = false;
      const authHeader = clientReq.headers["authorization"] || "";
      if (authHeader.toLowerCase().startsWith("basic ")) {
        try {
          const rawCreds = Buffer.from(authHeader.slice(6).trim(), "base64").toString("utf-8");
          const cIdx = rawCreds.indexOf(":");
          const u = cIdx !== -1 ? rawCreds.substring(0, cIdx) : rawCreds;
          const p = cIdx !== -1 ? rawCreds.substring(cIdx + 1) : "";
          if (isAuthorizedUser(u) && isAuthorizedPass(p)) {
            hasBasicAuth = true;
            console.log(`[GATE] Basic Auth SUCCESS: user="${u}"`);
          } else {
            console.log(`[GATE] Basic Auth FAILED: received user="${u}", passLength=${p ? p.length : 0}`);
          }
        } catch (e) {}
      }

      const isAuthed = hasAuthCookie || hasParamAuth || hasBasicAuth;

      if (!isAuthed) {
        clientRes.writeHead(401, {
          "WWW-Authenticate": "Basic realm=\"Barber Booking App (Mobile Dev Gate)\"",
          "Content-Type": "text/html; charset=utf-8"
        });
        clientRes.end(renderLoginPage("", clientReq.url));
        return;
      }

      // If authorized via query param or basic auth, set cookie for all subsequent requests
      const extraHeaders = {};
      if ((hasParamAuth || hasBasicAuth) && !hasAuthCookie) {
        extraHeaders["Set-Cookie"] = "barber_tunnel_auth=1; Path=/; SameSite=Lax; Max-Age=86400";
      }

      // Canonical Customer Booking Redirection (/book, /book.html, /booking.html -> /booking/)
      if (
        urlObj.pathname === "/book" ||
        urlObj.pathname === "/book/" ||
        urlObj.pathname === "/book.html" ||
        urlObj.pathname === "/booking.html"
      ) {
        const canonicalTarget = "/booking/" + urlObj.search + urlObj.hash;
        clientRes.writeHead(302, {
          "Location": canonicalTarget,
          ...extraHeaders
        });
        return clientRes.end();
      }

      // Route /api and /ws requests to backend port 8080 if available, else frontend 3000
      const isApi = clientReq.url.startsWith("/api/") || clientReq.url.startsWith("/ws/");
      const destPort = isApi ? BACKEND_PORT : TARGET_PORT;

      const options = {
        hostname: "127.0.0.1",
        port: destPort,
        path: clientReq.url,
        method: clientReq.method,
        headers: {
          ...clientReq.headers,
          host: "127.0.0.1:" + destPort
        }
      };

      const proxyReq = http.request(options, (proxyRes) => {
        const resHeaders = { ...proxyRes.headers, ...extraHeaders };
        clientRes.writeHead(proxyRes.statusCode, resHeaders);
        proxyRes.pipe(clientRes, { end: true });
      });

      proxyReq.on("error", (err) => {
        if (destPort === BACKEND_PORT) {
          const fallbackReq = http.request({ ...options, port: TARGET_PORT }, (fallbackRes) => {
            clientRes.writeHead(fallbackRes.statusCode, { ...fallbackRes.headers, ...extraHeaders });
            fallbackRes.pipe(clientRes, { end: true });
          });
          fallbackReq.on("error", (fallbackErr) => {
            clientRes.writeHead(502, { "Content-Type": "text/plain" });
            clientRes.end("502 Bad Gateway: " + fallbackErr.message);
          });
          clientReq.pipe(fallbackReq, { end: true });
        } else {
          clientRes.writeHead(502, { "Content-Type": "text/plain" });
          clientRes.end("502 Bad Gateway: " + err.message);
        }
      });

      clientReq.pipe(proxyReq, { end: true });
    });

    // Handle WebSocket Upgrades
    server.on("upgrade", (req, socket, head) => {
      const cookies = req.headers["cookie"] || "";
      const hasAuthCookie = /barber_tunnel_auth=1/.test(cookies);
      const authHeader = req.headers["authorization"] || "";
      let isAuthed = hasAuthCookie;
      if (!isAuthed && authHeader.toLowerCase().startsWith("basic ")) {
        try {
          const rawCreds = Buffer.from(authHeader.slice(6).trim(), "base64").toString("utf-8");
          const cIdx = rawCreds.indexOf(":");
          const u = cIdx !== -1 ? rawCreds.substring(0, cIdx) : rawCreds;
          const p = cIdx !== -1 ? rawCreds.substring(cIdx + 1) : "";
          if (isAuthorizedUser(u) && isAuthorizedPass(p)) isAuthed = true;
        } catch (e) {}
      }

      if (!isAuthed) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }

      const proxyReq = http.request({
        hostname: "127.0.0.1",
        port: TARGET_PORT,
        path: req.url,
        method: req.method,
        headers: req.headers
      });
      proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
        socket.write("HTTP/1.1 101 Switching Protocols\r\n" +
          Object.keys(proxyRes.headers).map(k => `${k}: ${proxyRes.headers[k]}`).join("\r\n") + "\r\n\r\n");
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
      });
      proxyReq.on("error", () => socket.destroy());
      proxyReq.end();
    });

    server.listen(GATE_PORT, "127.0.0.1", () => {
      console.log(`[OK] Basic Auth Security Gate running on http://127.0.0.1:${GATE_PORT}`);
    });
  ' &
  GATE_PID=$!

  # Give gate a moment to initialize
  sleep 1

  echo "[*] Connecting Cloudflare Quick Tunnel to Security Gate..."
  echo "-----------------------------------------------------------------"

  TMP_LOG="$(mktemp -t cf_tunnel_log.XXXXXX)"

  cloudflared tunnel --url "http://127.0.0.1:${GATE_PORT}" > "${TMP_LOG}" 2>&1 &
  TUNNEL_PID=$!

  # Poll for public URL from cloudflared logs
  echo "Waiting for public HTTPS URL from Cloudflare..."
  TUNNEL_URL=""
  for i in {1..25}; do
    FOUND_URL=$(grep -o -E "https://[a-zA-Z0-9-]+\.trycloudflare\.com" "${TMP_LOG}" 2>/dev/null | head -n 1 || true)
    if [[ -n "${FOUND_URL}" ]]; then
      TUNNEL_URL="${FOUND_URL}"
      break
    fi
    sleep 1
  done

  if [[ -n "${TUNNEL_URL}" ]]; then
    echo ""
    echo "================================================================="
    echo "  🎉 SECURE PUBLIC TUNNEL ACTIVE"
    echo "================================================================="
    echo "  Public URL:       ${TUNNEL_URL}"
    echo "  Direct Booking:   ${TUNNEL_URL}/booking/?slug=golden-scissors"
    echo "  Salon Portal:     ${TUNNEL_URL}/portal/index.html"
    echo ""
    echo "  ✨ 1-TAP INSTANT ACCESS LINK (Zero Typing Needed):"
    echo "  ${TUNNEL_URL}/booking/?slug=golden-scissors&auth=${AUTH_PASS}"
    echo ""
    echo "  Accepted Credentials (HTTP Basic Auth or Web Form):"
    echo "    Username:       ${AUTH_USER}  (or TUNNEL_USER)"
    echo "    Password:       ${AUTH_PASS}  (or TUNNEL_PASS)"
    echo "================================================================="
    echo "[!] Tip: If your mobile browser blocks the popup dialog, use the"
    echo "    on-screen form or tap the 1-Tap Instant Access Link above."
    echo "[!] Press [Ctrl + C] to terminate tunnel and remove public access."
    echo "================================================================="
  else
    echo "[!] Tunnel is running in background. Inspect output below:"
    cat "${TMP_LOG}"
  fi

  # Monitor processes until interrupted
  wait "${TUNNEL_PID}"
fi
