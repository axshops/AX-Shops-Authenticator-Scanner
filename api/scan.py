from http.server import BaseHTTPRequestHandler
import json
import os
import cgi
from io import BytesIO
from supabase import create_client

# ---------- CONFIG ----------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SCAN_DB = "scans"
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
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_POST(self):
        try:
            if not backend:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": "Database not configured"}).encode())
                return

            # Parse multipart form data
            content_type = self.headers.get('Content-Type')
            if not content_type or 'multipart/form-data' not in content_type:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Content-Type must be multipart/form-data"}).encode())
                return

            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            # Parse form data
            form = cgi.FieldStorage(
                fp=BytesIO(body),
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST'}
            )

            # Get token
            token = form.getvalue('token')
            if not token:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Token required"}).encode())
                return

            # Validate token
            res = backend.table(TOKEN_DB).select("*").eq("token", token).single().execute()
            if not res.data or res.data.get("used"):
                self._set_headers(401)
                self.wfile.write(json.dumps({"error": "Token invalid or already used"}).encode())
                return

            order_id = res.data["order_id"]
            uploads = []

            # Process files
            file_keys = [key for key in form.keys() if key.startswith('file')]
            if not file_keys:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "No files uploaded"}).encode())
                return

            for idx, file_key in enumerate(file_keys, 1):
                file_item = form[file_key]
                if not file_item.file:
                    continue

                # Validate file type
                content_type = file_item.type or ''
                if not content_type.startswith('image/'):
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": f"File {idx} is not an image"}).encode())
                    return

                filename = file_item.filename or f'scan{idx}.jpg'
                ext = os.path.splitext(filename)[1].lower()
                if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
                    self._set_headers(400)
                    self.wfile.write(json.dumps({"error": f"File {idx} invalid extension"}).encode())
                    return

                # Upload to Supabase storage
                path = f"scans/{order_id}/scan{idx}{ext}"
                file_data = file_item.file.read()
                backend.storage.from_("scans").upload(
                    path=path,
                    file=file_data,
                    file_options={"content-type": content_type}
                )
                url = backend.storage.from_("scans").get_public_url(path)
                uploads.append(url)

                # Store in database
                backend.table(SCAN_DB).insert({
                    "token": token,
                    "order_id": order_id,
                    "step": idx,
                    "image_url": url,
                    "hash": "placeholder"
                }).execute()

            # Mark token as used
            backend.table(TOKEN_DB).update({"used": True}).eq("token", token).execute()

            # Update order status
            backend.table("orders").update({
                "scans_completed": True,
                "status": "authentication_submitted"
            }).eq("order_id", order_id).execute()

            self._set_headers(200)
            self.wfile.write(json.dumps({
                "status": "success",
                "files_uploaded": len(uploads),
                "order_id": order_id
            }).encode())

        except Exception as e:
            self._set_headers(500)
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_GET(self):
        self._set_headers(405)
        self.wfile.write(json.dumps({"error": "Method not allowed"}).encode())
