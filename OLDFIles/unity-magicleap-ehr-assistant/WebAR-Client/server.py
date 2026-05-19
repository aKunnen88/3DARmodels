import os
import json
import socket
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, HTTPServer
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOTENV_PATH = os.path.join(BASE_DIR, 'LLMIntegration', '.env')
SKILL_PATH  = os.path.join(BASE_DIR, 'LLMIntegration', 'ArduinoExpert', 'Skill.md')

# ── Ollama (local) — primary backend ───────────────────────────────────────
OLLAMA_URL   = "http://localhost:11434/v1/chat/completions"
OLLAMA_MODEL = "qwen2.5:3b"   # must match what you pulled with `ollama run qwen2.5:3b`
API_TIMEOUT  = 120             # local Ollama is fast; 120s is more than enough

# ── NVIDIA API — fallback if Ollama is not running ─────────────────────────
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
load_dotenv(DOTENV_PATH)
NVIDIA_KEY = os.getenv("NVIDIA_API_KEY", "").strip()
if NVIDIA_KEY.lower().startswith("bearer "):
    NVIDIA_KEY = NVIDIA_KEY[7:].strip()

# ── Arduino Expert Skill ────────────────────────────────────────────────────
SKILL_CONTENT = ""
if os.path.exists(SKILL_PATH):
    with open(SKILL_PATH, 'r', encoding='utf-8') as f:
        raw = f.read()
    SKILL_CONTENT = raw[:2000] + ("\n\n[...truncated...]" if len(raw) > 2000 else "")
    print(f"[OK] Arduino Expert Skill loaded ({len(SKILL_CONTENT)} chars)")
else:
    print(f"[!!] Skill not found at {SKILL_PATH}")

# Check if Ollama is reachable
def ollama_available():
    try:
        urllib.request.urlopen("http://localhost:11434", timeout=2)
        return True
    except Exception:
        return False

USE_OLLAMA = ollama_available()
if USE_OLLAMA:
    print(f"[OK] Ollama detected -- using LOCAL model: {OLLAMA_MODEL}")
elif NVIDIA_KEY:
    print(f"[!!] Ollama not found -- falling back to NVIDIA API (key: {NVIDIA_KEY[:10]}...)")
else:
    print("[!!] No LLM backend available! Start Ollama or add NVIDIA_API_KEY to .env")

# ---------------------------------------------------------------------------
# Request Handler
# ---------------------------------------------------------------------------
class ARServerHandler(SimpleHTTPRequestHandler):

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

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
                data["messages"].insert(0, {
                    "role": "system",
                    "content": (
                        "You are an Arduino & Ultrasonic Sensor expert assistant in an AR environment. "
                        "Reference material:\n\n" + SKILL_CONTENT
                    )
                })

            # Always use local Ollama model if available
            if USE_OLLAMA:
                data["model"] = OLLAMA_MODEL
                api_url = OLLAMA_URL
                headers = {"Content-Type": "application/json"}
                backend = f"Ollama ({OLLAMA_MODEL})"
            else:
                api_url = NVIDIA_API_URL
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {NVIDIA_KEY}"
                }
                backend = f"NVIDIA ({data.get('model', 'unknown')})"

            # Remove unsupported keys for Ollama
            data.pop("chat_template_kwargs", None)

            payload = json.dumps(data).encode('utf-8')
            req = urllib.request.Request(api_url, data=payload, headers=headers)

            print(f"  → [{backend}] Processing query (timeout={API_TIMEOUT}s)...")

            with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
                body = resp.read()

            print(f"  ← [{backend}] Responded ({len(body)} bytes) ✅")

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(body)


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

    if socket.has_ipv6:
        HTTPServer.address_family = socket.AF_INET6
        try:
            httpd = HTTPServer(('', port), ARServerHandler)
            print(f"[>>] Server running on http://[::]:{port} (IPv6) -- Ollama: {USE_OLLAMA}")
        except OSError:
            HTTPServer.address_family = socket.AF_INET
            httpd = HTTPServer(('0.0.0.0', port), ARServerHandler)
            print(f"[>>] Server running on http://0.0.0.0:{port} (IPv4) -- Ollama: {USE_OLLAMA}")
    else:
        HTTPServer.address_family = socket.AF_INET
        httpd = HTTPServer(('0.0.0.0', port), ARServerHandler)
        print(f"[>>] Server running on http://0.0.0.0:{port} -- Ollama: {USE_OLLAMA}")

    httpd.serve_forever()
