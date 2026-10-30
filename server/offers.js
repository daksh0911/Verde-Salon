import { db, isoDate } from './db.js';
import { httpError } from './middleware.js';
// Single source of truth for offer rules, used by both preview and booking.
export function checkOffer(code, userId, services) {
  const o = db.prepare('SELECT * FROM offers WHERE code = ? AND active = 1').get(String(code).trim().toUpperCase());
  if (!o || (o.user_id && o.user_id !== userId)) throw httpError(400, 'That offer code is not valid for your account.');
  if (o.expires_at && o.expires_at < isoDate()) throw httpError(400, 'That offer has expired.');
  if (o.used_count >= o.max_uses) throw httpError(400, 'That offer has already been used.');
  if (o.first_visit_only && db.prepare("SELECT 1 FROM appointments WHERE customer_id = ? AND status IN ('booked','completed')").get(userId)) throw httpError(400, 'That offer is for first visits only.');
  const eligible = o.category ? services.filter((s) => s.category.toLowerCase() === o.category.toLowerCase()) : services;
  if (!eligible.length) throw httpError(400, `That offer applies to ${o.category} services only.`);
  const base = eligible.reduce((a, s) => a + s.price, 0);
  if (base < o.min_spend) throw httpError(400, `Minimum spend of ₹${o.min_spend} on eligible services.`);
  const discount = Math.min(base, o.discount_type === 'percent' ? Math.round((base * o.discount_value) / 100) : o.discount_value);
  return { offer: o, discount };
}
