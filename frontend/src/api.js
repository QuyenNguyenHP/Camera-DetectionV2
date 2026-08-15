const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.detail || "Request failed");
    error.status = response.status;
    if (response.status === 401 && path !== "/auth/login") {
      window.dispatchEvent(new Event("camera-auth-expired"));
    }
    throw error;
  }
  return payload;
}

export async function getAuthStatus() {
  return request("/auth/status");
}

export async function getCurrentUser() {
  return request("/auth/me").then((payload) => payload.user);
}

export async function loginUser(username, password) {
  return request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then((payload) => payload.user);
}

export async function logoutUser() {
  return request("/auth/logout", { method: "POST" });
}

export async function getUsers() {
  return request("/users");
}

export async function createUser(username, password, role) {
  return request("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, role }),
  });
}

export async function analyzeImage(
  blob,
  classes,
  detectObjects,
  recognizeFaces,
  detectGestures,
  controlHome,
  trackingId = "",
) {
  const form = new FormData();
  form.append("image", blob, "frame.jpg");
  form.append("classes", classes);
  form.append("detect_objects", String(detectObjects));
  form.append("recognize_faces", String(recognizeFaces));
  form.append("detect_gestures", String(detectGestures));
  form.append("control_home", String(controlHome));
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
