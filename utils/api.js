// src/utils/api.js
// Small fetch helpers shared by the CSV import module.
//
// API_BASE is empty by default, which makes every fetch a same-origin,
// relative request (e.g. "/api/students") - this is what you want when
// Express serves the built frontend itself (see server.js), such as a
// single-service Railway deploy.
//
// If the frontend and backend are ever deployed as two separate
// services/origins, set VITE_API_BASE (e.g. in Railway's frontend
// service variables) to the backend's full URL, such as
// "https://your-backend.up.railway.app".
export const API_BASE = import.meta.env.VITE_API_BASE || "";

/**
 * Reads the JWT the same way the rest of the app would once a login
 * flow exists (see middleware/auth.js on the backend). Until then this
 * simply returns null and requests go out without an Authorization
 * header -- set SKIP_AUTH=true in the backend .env during local dev.
 */
function getToken() {
  return localStorage.getItem("token") || null;
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error((await safeJson(res))?.error || `Request failed (${res.status})`);
  return res.json();
}

export async function apiPostJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await safeJson(res))?.error || `Request failed (${res.status})`);
  return res.json();
}

/**
 * Uploads a file with upload-progress reporting. fetch() has no
 * upload progress event, so this uses XMLHttpRequest deliberately.
 */
export function apiUploadFile(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);

    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data?.error || `Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
