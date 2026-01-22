from http.server import BaseHTTPRequestHandler
import json
import os
from supabase import create_client

# ---------- CONFIG ----------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

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
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        if self.path == "/api" or self.path == "/api/":
            self._set_headers()
            response = {
                "status": "ok",
                "message": "AX Shops Authentication Scanner API"
            }
            self.wfile.write(json.dumps(response).encode())
        
        elif self.path == "/api/health":
            self._set_headers()
            response = {
                "status": "ok",
                "database": "connected" if backend else "not configured"
            }
            self.wfile.write(json.dumps(response).encode())
        
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode())

    def do_POST(self):
        self._set_headers(405)
        self.wfile.write(json.dumps({"error": "Method not allowed on this endpoint"}).encode())

    def do_POST(self):
        self._set_headers(405)
        self.wfile.write(json.dumps({"error": "Method not allowed on this endpoint"}).encode())
