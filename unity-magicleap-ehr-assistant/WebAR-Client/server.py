import os
import json
import socket
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, HTTPServer
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Load NVIDIA API key from LLMIntegration/.env
# ---------------------------------------------------------------------------
BASE_DIR       = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOTENV_PATH    = os.path.join(BASE_DIR, 'LLMIntegration', '.env')
SKILL_PATH     = os.path.join(BASE_DIR, 'LLMIntegration', 'ArduinoExpert', 'Skill.md')
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
API_TIMEOUT    = 60   # seconds – long enough for large model first-token latency

load_dotenv(DOTENV_PATH)
API_KEY = os.getenv("NVIDIA_API_KEY", "").strip()

# Strip accidental 'Bearer ' prefix in .env value
if API_KEY.lower().startswith("bearer "):
    API_KEY = API_KEY[7:].strip()

if not API_KEY:
    print(f"⚠️  NVIDIA_API_KEY not found! Check {DOTENV_PATH}")
else:
    print(f"✅ NVIDIA API KEY loaded from {DOTENV_PATH} (starts with: {API_KEY[:10]}...)")

# Pre-load Arduino Expert Skill once at startup
SKILL_CONTENT = ""
if os.path.exists(SKILL_PATH):
    with open(SKILL_PATH, 'r', encoding='utf-8') as f:
        raw = f.read()
    # Truncate to avoid oversized API payloads / timeouts (first 2000 chars covers all key facts)
    SKILL_CONTENT = raw[:2000] + ("\n\n[...skill truncated for token efficiency...]" if len(raw) > 2000 else "")
    print(f"✅ Arduino Expert Skill loaded ({len(SKILL_CONTENT)} chars)")
else:
    print(f"⚠️  Skill not found at {SKILL_PATH}")

# ---------------------------------------------------------------------------
# Request Handler
# ---------------------------------------------------------------------------
class ARServerHandler(SimpleHTTPRequestHandler):

    # ---- CORS helpers -------------------------------------------------------
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests (required by browsers for cross-origin POST)."""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    # ---- LLM proxy ----------------------------------------------------------
    def do_POST(self):
        if self.path != '/api/chat':
            super().do_POST()
            return

        content_length = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(content_length)

        try:
            data = json.loads(raw_body)

            # Inject Arduino Expert Skill as first system message
            if SKILL_CONTENT and "messages" in data:
                skill_msg = {
                    "role": "system",
                    "content": (
                        "You are an Arduino & Ultrasonic Sensor expert. "
                        "Use the following reference material to answer questions:\n\n"
                        + SKILL_CONTENT
                    )
                }
                data["messages"].insert(0, skill_msg)

            payload = json.dumps(data).encode('utf-8')

            req = urllib.request.Request(
                NVIDIA_API_URL,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {API_KEY}"
                }
            )

            print(f"  → Forwarding to NVIDIA API (model={data.get('model')}, timeout={API_TIMEOUT}s)...")

            with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
                nvidia_body = resp.read()

            print(f"  ← NVIDIA API responded ({len(nvidia_body)} bytes)")

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(nvidia_body)

        except urllib.error.HTTPError as e:
            err_body = e.read()
            print(f"  ✗ NVIDIA HTTP error {e.code}: {err_body[:200]}")
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(err_body)

        except Exception as e:
            print(f"  ✗ Server error: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    # Silence only pure static file 200 responses to keep terminal clean
    def log_message(self, fmt, *args):
        # Always log: let parent handle it
        super().log_message(fmt, *args)

# ---------------------------------------------------------------------------
# Start Server (IPv6 with IPv4 fallback – required for ngrok on Windows)
# ---------------------------------------------------------------------------
if __name__ == '__main__':
    port = 8000

    # Try IPv6 first because ngrok on Windows often tunnels to [::1]
    if socket.has_ipv6:
        HTTPServer.address_family = socket.AF_INET6
        try:
            httpd = HTTPServer(('', port), ARServerHandler)
            print(f"🚀 Server running on http://[::]:{ port } (IPv6)")
        except OSError:
            HTTPServer.address_family = socket.AF_INET
            httpd = HTTPServer(('0.0.0.0', port), ARServerHandler)
            print(f"🚀 Server running on http://0.0.0.0:{port} (IPv4 fallback)")
    else:
        HTTPServer.address_family = socket.AF_INET
        httpd = HTTPServer(('0.0.0.0', port), ARServerHandler)
        print(f"🚀 Server running on http://0.0.0.0:{port}")

    httpd.serve_forever()
