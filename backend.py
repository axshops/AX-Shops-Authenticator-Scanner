from fastapi import FastAPI, HTTPException, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import datetime as dt
import os
import httpx
from supabase import create_client

app = FastAPI(title="AX Shops Authentication Scanner", version="1.0")

# ---------- CONFIG ----------
SUPABASE_URL   = os.getenv("SUPABASE_URL")
SUPABASE_KEY   = os.getenv("SUPABASE_KEY")
SCAN_DB        = "scans"
TOKEN_DB       = "scan_tokens"
EXPIRE_MIN     = 60
backend = create_client(SUPABASE_URL, SUPABASE_KEY)

# ---------- CORS ----------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- MODELS ----------
class ValidateResponse(BaseModel):
    valid: bool

class UploadResponse(BaseModel):
    status: str
    scans_completed: bool

# ---------- ENDPOINTS ----------
@app.get("/validate-token", response_model=ValidateResponse)
def validate_token(token: str):
    res = backend.table(TOKEN_DB).select("*").eq("token", token).single().execute()
    if not res.data or res.data["used"] or dt.datetime.utcnow() > dt.datetime.fromisoformat(res.data["expires_at"]):
        return ValidateResponse(valid=False)
    return ValidateResponse(valid=True)

@app.post("/upload", response_model=UploadResponse)
async def upload(
    token: str = Form(...),
    step1: UploadFile = File(...),
    step2: UploadFile = File(...),
    step3: UploadFile = File(...),
    step4: UploadFile = File(...),
    step5: UploadFile = File(...),
    step6: UploadFile = File(...),
    step7: UploadFile = File(...)
):
    # validate token
    res = backend.table(TOKEN_DB).select("*").eq("token", token).single().execute()
    if not res.data or res.data["used"]:
        raise HTTPException(status_code=401, detail="Token invalid or already used")

    order_id = res.data["order_id"]
    files = [step1, step2, step3, step4, step5, step6, step7]
    uploads = []

    for idx, file in enumerate(files, 1):
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"Step {idx} is not an image")
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
            raise HTTPException(status_code=400, detail=f"Step {idx} invalid extension")

        # upload to Supabase storage
        path = f"scans/{order_id}/step{idx}{ext}"
        backend.storage.from_("scans").upload(path=path, file=file.file, file_options={"content-type": file.content_type})
        url = backend.storage.from_("scans").get_public_url(path)
        uploads.append(url)

    # mark token used
    backend.table(TOKEN_DB).update({"used": True}).eq("token", token).execute()

    # store each step
    for idx, url in enumerate(uploads, 1):
        backend.table(SCAN_DB).insert({
            "token": token,
            "order_id": order_id,
            "step": idx,
            "image_url": url,
            "hash": "phash_placeholder"  # backend can compute
        }).execute()

    # unlock order
    backend.table("orders").update({"scans_completed": True, "status": "authentication_submitted"}).eq("order_id", order_id).execute()

    return UploadResponse(status="uploaded", scans_completed=True)

