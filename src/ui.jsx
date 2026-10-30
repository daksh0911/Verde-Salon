import { createContext, useCallback, useContext, useState } from 'react';
const asset = (path) => `${import.meta.env.BASE_URL}${path}`;
const Toast = createContext(() => {});
export const useToast = () => useContext(Toast);
export function ToastProvider({ children }) {
  const [m, set] = useState(null);
  const show = useCallback((text, err) => { set({ text, err }); setTimeout(() => set(null), 3800); }, []);
  return <Toast.Provider value={show}>{children}{m && <div className={`toast${m.err ? ' err' : ''}`} role="status">{m.text}</div>}</Toast.Provider>;
}
export const Stars = ({ n }) => <span aria-label={`${n} of 5`} className="stars">{'★'.repeat(Math.round(n))}{'☆'.repeat(5 - Math.round(n))}</span>;
const resolveImg = (src) => {
  if (!src) return asset('hero.jpg');
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
  const clean = src.startsWith('/') ? src.slice(1) : src;
  return asset(clean);
};
export const Photo = ({ src, alt = '', className = '' }) => <img className={`ph ${className}`} src={resolveImg(src)} alt={alt} loading="lazy" onError={(e) => { e.currentTarget.src = asset('hero.jpg'); }} />;
const defaultServiceImages = {
  'women:hair': asset('img/svc-women-cut.jpg'),
  'women:colour': asset('img/svc-women-colour.jpg'),
  'women:skin': asset('img/svc-women-facial.jpg'),
  'women:spa': asset('img/svc-women-spa.jpg'),
  'women:nails': asset('img/svc-women-nails.jpg'),
  'women:bridal': asset('img/svc-women-bridal.jpg'),
  'men:hair': asset('img/svc-men-cut.jpg'),
  'men:beard': asset('img/svc-men-beard.jpg'),
  'men:colour': asset('img/svc-men-colour.jpg'),
  'men:skin': asset('img/svc-men-facial.jpg'),
  'men:spa': asset('img/svc-men-spa.jpg'),
  'men:nails': asset('img/svc-men-manicure.jpg'),
};
export const serviceImage = (service) => {
  if (!service) return asset('hero.jpg');
  const key = `${service.gender || 'unisex'}:${String(service.category || '').toLowerCase()}`;
  const isSeedImage = /^\/img\/svc-(women-|men-)/.test(service.image || '');
  return isSeedImage ? (defaultServiceImages[key] || service.image) : (service.image || defaultServiceImages[key] || asset('hero.jpg'));
};
export const Empty = ({ children }) => <p className="hint">{children}</p>;
export const Field = ({ label, children }) => <label className="fld"><span>{label}</span>{children}</label>;
// run an async action with toast feedback
export const useAct = () => { const toast = useToast(); return async (fn, ok) => { try { const r = await fn(); if (ok) toast(ok); return r; } catch (e) { toast(e.message, true); } }; };
