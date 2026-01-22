// ---------- CONFIG ----------
const API_URL = window.location.origin + "/api";

// ---------- STATE ----------
let token = null;
let selectedFiles = [];

// ---------- DOM ----------
const tokenSection = document.getElementById("token-section");
const tokenField = document.getElementById("token");
const validateBtn = document.getElementById("validate-btn");
const tokenError = document.getElementById("token-error");
const uploadSection = document.getElementById("upload-section");
const fileInput = document.getElementById("file-input");
const fileList = document.getElementById("file-list");
const submitBtn = document.getElementById("submit-btn");
const uploadStatus = document.getElementById("upload-status");
const success = document.getElementById("success");

// ---------- TOKEN VALIDATION ----------
validateBtn.addEventListener("click", async () => {
  const inputToken = tokenField.value.trim();
  if (!inputToken) {
    tokenError.textContent = "Token required";
    return;
  }

  tokenError.textContent = "";
  validateBtn.disabled = true;
  validateBtn.textContent = "Validating...";

  try {
    const res = await fetch(`${API_URL}/validate-token?token=${encodeURIComponent(inputToken)}`);
    const data = await res.json();

    if (!data.valid) {
      tokenError.textContent = "Invalid or expired token";
      validateBtn.disabled = false;
      validateBtn.textContent = "Validate Token";
      return;
    }

    token = inputToken;
    tokenSection.classList.add("hidden");
    uploadSection.classList.remove("hidden");
  } catch (err) {
    tokenError.textContent = "Connection error. Please try again.";
    validateBtn.disabled = false;
    validateBtn.textContent = "Validate Token";
  }
});

// ---------- FILE SELECTION ----------
fileInput.addEventListener("change", (e) => {
  selectedFiles = Array.from(e.target.files);
  
  if (selectedFiles.length > 7) {
    selectedFiles = selectedFiles.slice(0, 7);
    alert("Maximum 7 files allowed. Only first 7 selected.");
  }

  // Display file list
  fileList.innerHTML = selectedFiles.map((file, idx) => 
    `<div>${idx + 1}. ${file.name} (${(file.size / 1024).toFixed(1)} KB)</div>`
  ).join('');

  submitBtn.disabled = selectedFiles.length === 0;
});

// ---------- SUBMIT ----------
submitBtn.addEventListener("click", async () => {
  if (selectedFiles.length === 0) {
    alert("Please select at least one file");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Uploading...";
  uploadStatus.textContent = "Uploading files...";

  try {
    const formData = new FormData();
    formData.append("token", token);
    
    selectedFiles.forEach((file, idx) => {
      formData.append(`file${idx}`, file);
    });

    const res = await fetch(`${API_URL}/scan`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Upload failed");
    }

    uploadSection.classList.add("hidden");
    success.classList.remove("hidden");
  } catch (err) {
    uploadStatus.textContent = `Error: ${err.message}`;
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Proof";
  }
});
