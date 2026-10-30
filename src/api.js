import { useEffect, useState } from 'react';
export class ApiError extends Error {}
export async function api(method, path, body) {
  const r = await fetch('/api' + path, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body && JSON.stringify(body) }).catch(() => { throw new ApiError('Cannot reach the server.'); });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(data?.message || 'Something went wrong.');
  return data;
}
export const get = (p) => api('GET', p), post = (p, b) => api('POST', p, b ?? {}), put = (p, b) => api('PUT', p, b ?? {}), patch = (p, b) => api('PATCH', p, b ?? {}), del = (p) => api('DELETE', p);
// data: undefined while loading, null on error. reload() refetches.
export function useGet(path) {
  const [data, set] = useState(undefined), [n, setN] = useState(0);
  useEffect(() => { if (!path) return; let live = true; get(path).then((d) => live && set(d)).catch(() => live && set(null)); return () => { live = false; }; }, [path, n]);
  return [data, () => setN((x) => x + 1)];
}
export const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
export const clock = (m) => `${(Math.floor(m / 60) % 12) || 12}:${String(m % 60).padStart(2, '0')} ${m >= 720 ? 'PM' : 'AM'}`;
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const next14 = () => [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return ymd(d); });
export const dayLabel = (s) => new Date(`${s}T00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
export const WA = 'https://wa.me/919999999999?text=';
