const BASE = '/api';

async function handle(res) {
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText);
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }
  return data;
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  return h;
}

export const api = {
  get: (path, opts) => fetch(`${BASE}${path}`, { credentials: 'include', ...opts }).then(handle),
  post: (path, body, opts) => fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', headers: headers(), body: JSON.stringify(body || {}), ...opts }).then(handle),
  patch: (path, body, opts) => fetch(`${BASE}${path}`, { method: 'PATCH', credentials: 'include', headers: headers(), body: JSON.stringify(body || {}), ...opts }).then(handle),
  del: (path, opts) => fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include', ...opts }).then(handle),
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${BASE}/media/upload`, { method: 'POST', credentials: 'include', body: fd }).then(handle);
  },
};

export const config = () => api.get('/config');
export const health = () => fetch('/health').then(r => r.json());
