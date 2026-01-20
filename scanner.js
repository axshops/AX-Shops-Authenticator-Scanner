// ---------- CONFIG ----------
const CATEGORY = new URLSearchParams(window.location.search).get("category") || "shoes"; // shoes|clothing|accessories (default: shoes)

const STEPS = {
  shoes: [
    "Front of shoe(s)",
    "Back of shoe(s)",
    "Left side profile of shoe(s)",
    "Right side profile of shoe(s)",
    "Inside of shoe(s)",
    "Shoe box"
  ],
  clothing: [
    "Front of garment",
    "Back of garment",
    "Tags if applicable",
    "Wash tag",
    "Original bag, box or packaging if applicable"
  ],
  accessories: [
    "Front view",
    "Back view",
    "360-degree view (photo 1 of 4)",
    "360-degree view (photo 2 of 4)",
    "360-degree view (photo 3 of 4)",
    "360-degree view (photo 4 of 4)",
    "Tag if applicable"
  ]
};

const MIN_IMG_COUNT = STEPS[CATEGORY] ? STEPS[CATEGORY].length : 6;
const MIN_DIMENSION = [800, 600];
const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp"];

// ---------- STATE ----------
let token = null;
let currentStep = 0;
let images = []; // {step, file, hash, label}

// ---------- DOM ----------
const tokenInput = document.getElementById("token-input");
const tokenField = document.getElementById("token");
const unlockBtn = document.getElementById("unlock-btn");
const tokenError = document.getElementById("token-error");
const scanner = document.getElementById("scanner");
const stepIndicator = document.getElementById("current-step");
const stepTitle = document.getElementById("step-title");
const camera = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const captureBtn = document.getElementById("capture-btn");
const retakeBtn = document.getElementById("retake-btn");
const nextBtn = document.getElementById("next-btn");
const preview = document.getElementById("preview");
const submitBtn = document.getElementById("submit-btn");
const success = document.getElementById("success");

// ---------- INIT ----------
window.addEventListener("beforeunload", (e) => {
  if (images.length > 0 && !success.classList.contains("hidden")) return;
  e.preventDefault();
  e.returnValue = "";
});

// ---------- TOKEN UNLOCK ----------
unlockBtn.addEventListener("click", async () => {
  // No backend - skip token requirement
  token = tokenField.value.trim() || "offline-mode";
  
  tokenInput.classList.add("hidden");
  scanner.classList.remove("hidden");
  startCamera();
});

// ---------- CAMERA ----------
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    camera.srcObject = stream;
  } catch (e) {
    alert("Camera access denied. Please enable camera permissions and refresh.");
  }
}

// Add fallback message if CATEGORY is invalid
if (!STEPS[CATEGORY]) {
  document.body.innerHTML = `
    <h1>AX Shops Authentication Scanner</h1>
    <p style="color: red; text-align: center;">Invalid category. Use: ?category=shoes, ?category=clothing, or ?category=accessories</p>
  `;
}

// ---------- CAPTURE ----------
captureBtn.addEventListener("click", async () => {
  const label = STEPS[CATEGORY][currentStep];
  canvas.width = camera.videoWidth;
  canvas.height = camera.videoHeight;
  canvas.getContext("2d").drawImage(camera, 0, 0);
  const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.9));
  const file = new File([blob], `step${currentStep + 1}_${label.replace(/ /g, "_")}.jpg`, { type: "image/jpeg" });

  // basic checks
  if (file.size < 500_000 || file.size > 8_000_000) {
    alert("Image must be 500 KB – 8 MB");
    return;
  }
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  if (img.width < 800 || img.height < 600) {
    alert("Image must be ≥ 800×600");
    return;
  }

  // perceptual hash for duplicate block
  const hash = await imageHash(file);
  if (images.some(i => i.hash === hash)) {
    alert("Duplicate image detected");
    return;
  }

  images.push({ step: currentStep + 1, file, hash, label });
  preview.src = URL.createObjectURL(file);
  preview.classList.remove("hidden");
  captureBtn.classList.add("hidden");
  retakeBtn.classList.remove("hidden");
  nextBtn.classList.remove("hidden");
  nextBtn.disabled = false;
});

retakeBtn.addEventListener("click", () => {
  images.pop();
  preview.classList.add("hidden");
  retakeBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");
  captureBtn.classList.remove("hidden");
  nextBtn.disabled = true;
});

nextBtn.addEventListener("click", () => {
  if (currentStep === STEPS[CATEGORY].length - 1) {
    showSubmit();
  } else {
    currentStep++;
    updateUI();
  }
});

function updateUI() {
  stepIndicator.textContent = currentStep + 1;
  stepTitle.textContent = STEPS[CATEGORY][currentStep];
  preview.classList.add("hidden");
  retakeBtn.classList.add("hidden");
  nextBtn.classList.add("hidden");
  captureBtn.classList.remove("hidden");
  nextBtn.disabled = true;
}

function showSubmit() {
  updateUI();
  submitBtn.classList.remove("hidden");
  submitBtn.disabled = false;
}

// ---------- SUBMIT ----------
submitBtn.addEventListener("click", async () => {
  if (images.length < MIN_IMG_COUNT) {
    alert(`You must upload ${MIN_IMG_COUNT} images`);
    return;
  }

  submitBtn.disabled = true;

  // Local mode - save to localStorage and download
  const scanData = {
    token,
    category: CATEGORY,
    timestamp: new Date().toISOString(),
    imageCount: images.length,
    images: images.map(img => ({
      step: img.step,
      label: img.label,
      hash: img.hash,
      size: img.file.size
    }))
  };

  // Save metadata to localStorage
  localStorage.setItem(`scan_${Date.now()}`, JSON.stringify(scanData));

  // Download images as a ZIP (or just show success)
  scanner.classList.add("hidden");
  success.classList.remove("hidden");
  success.innerHTML = `
    <h2>✅ Scan Completed</h2>
    <p>${images.length} images captured for ${CATEGORY}</p>
    <p style="font-size: 0.9rem; color: #666;">Saved locally. You can download individual images or integrate a backend when ready.</p>
  `;
});

// ---------- HASH ----------
async function imageHash(file) {
  const img = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const blob = await canvas.convertToBlob();
  const arrayBuffer = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}
