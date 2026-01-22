from http.server import BaseHTTPRequestHandler
import json
import os
import datetime as dt
from urllib.parse import parse_qs, urlparse
from supabase import create_client

# ---------- CONFIG ----------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TOKEN_DB = "scan_tokens"

# Initialize Supabase client
backend = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        backend = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Failed to initialize Supabase: {e}")


class handler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        try:
            # Parse query parameters
            parsed = urlparse(self.path)
            params = parse_qs(parsed.query)
            token = params.get('token', [None])[0]

            if not token:
                self._set_headers(400)
                self.wfile.write(json.dumps({"valid": False, "error": "Token parameter required"}).encode())
                return

            if not backend:
                self._set_headers(500)
                self.wfile.write(json.dumps({"valid": False, "error": "Database not configured"}).encode())
                return

            # Validate token
            res = backend.table(TOKEN_DB).select("*").eq("token", token).single().execute()
            
            if not res.data or res.data.get("used") or dt.datetime.utcnow() > dt.datetime.fromisoformat(res.data.get("expires_at")):
                self._set_headers(200)
                self.wfile.write(json.dumps({"valid": False}).encode())
                return

            self._set_headers(200)
            self.wfile.write(json.dumps({"valid": True}).encode())

        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"valid": False, "error": str(e)}).encode())

    def do_POST(self):
        self._set_headers(405)
        self.wfile.write(json.dumps({"error": "Method not allowed"}).encode())
