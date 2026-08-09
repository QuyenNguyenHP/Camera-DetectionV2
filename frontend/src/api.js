const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "Request failed");
  return payload;
}

export async function analyzeImage(blob, classes, recognizeFaces, trackingId = "") {
  const form = new FormData();
  form.append("image", blob, "frame.jpg");
  form.append("classes", classes);
  form.append("recognize_faces", String(recognizeFaces));
  form.append("tracking_id", trackingId);
  return request("/analyze", { method: "POST", body: form });
}

export async function enrollFace(blob, name) {
  const form = new FormData();
  form.append("image", blob, "enrollment.jpg");
  form.append("name", name);
  return request("/faces/enroll", { method: "POST", body: form });
}

export async function getEnrolledFaces() {
  return request("/faces", { method: "GET" });
}
