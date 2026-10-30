import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db, getService, pointsOf, isoDate } from '../db.js';
import { auth, admin, validate, wrap, httpError } from '../middleware.js';
import { checkOffer } from '../offers.js';
const r = Router();
const live = "active = 1 AND used_count < max_uses AND (expires_at IS NULL OR expires_at >= date('now','localtime'))";

// Only the signed-in client's own offers are ever listed. There is no public code list.
r.get('/mine', auth, wrap((req, res) => res.json(db.prepare(`SELECT * FROM offers WHERE user_id = ? AND ${live} ORDER BY expires_at`).all(req.user.id))));
r.post('/validate', auth, validate(z.object({ code: z.string().trim().min(1), serviceIds: z.array(z.number().int()).min(1) })), wrap((req, res) => {
  const services = req.body.serviceIds.map(getService).filter(Boolean);
  const { offer, discount } = checkOffer(req.body.code, req.user.id, services);
  const total = services.reduce((a, s) => a + s.price, 0);
  res.json({ code: offer.code, title: offer.title, discount, finalAmount: total - discount });
}));

// Birthday offer is issued once a year when the client opens the app within 7 days of their birthday
r.post('/claim-birthday', auth, wrap((req, res) => {
  const b = db.prepare('SELECT birthday FROM users WHERE id = ?').pluck().get(req.user.id);
  if (!b) throw httpError(400, 'Add your birthday in your profile first.');
  const t = new Date(), bd = new Date(t.getFullYear(), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  if (Math.abs(bd - new Date(t.getFullYear(), t.getMonth(), t.getDate())) > 7 * 864e5) throw httpError(400, 'Your birthday offer opens a week before your birthday.');
  const code = `BDAY-${t.getFullYear()}-${req.user.id}`;
  if (db.prepare('SELECT 1 FROM offers WHERE code = ?').get(code)) throw httpError(409, 'You already claimed this year’s birthday offer.');
  db.prepare("INSERT INTO offers (code,title,description,user_id,discount_type,discount_value,expires_at) VALUES (?,?,?,?, 'percent', 20, date('now','+30 day'))").run(code, 'Happy birthday', '20% off any visit this month', req.user.id);
  res.status(201).json({ code });
}));

const TIERS = [{ points: 300, off: 100, minSpend: 500 }, { points: 600, off: 250, minSpend: 1000 }, { points: 1000, off: 500, minSpend: 1500 }];
r.get('/loyalty', auth, wrap((req, res) => res.json({
  points: pointsOf(req.user.id), tiers: TIERS,
  history: db.prepare('SELECT points, reason, created_at FROM loyalty_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(req.user.id),
})));
r.post('/redeem', auth, validate(z.object({ points: z.number().int() })), wrap((req, res) => {
  const t = TIERS.find((x) => x.points === req.body.points); if (!t) throw httpError(400, 'Unknown reward.');
  const code = db.transaction(() => {
    if (pointsOf(req.user.id) < t.points) throw httpError(400, 'Not enough points.');
    const c = 'REWARD-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    db.prepare("INSERT INTO loyalty_ledger (user_id,points,reason) VALUES (?,?,?)").run(req.user.id, -t.points, `redeemed ${c}`);
    db.prepare("INSERT INTO offers (code,title,description,user_id,discount_type,discount_value,min_spend,expires_at) VALUES (?,?,?,?, 'fixed', ?, ?, date('now','+90 day'))").run(c, `₹${t.off} reward`, `Redeemed for ${t.points} points`, req.user.id, t.off, t.minSpend);
    return c;
  })();
  res.status(201).json({ code });
}));

// Admin: create public-by-code (shared) or personal offers
r.get('/admin', auth, admin, wrap((req, res) => res.json(db.prepare('SELECT o.*, u.name user_name FROM offers o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 200').all())));
r.post('/admin', auth, admin, validate(z.object({
  code: z.string().trim().min(3).max(30), title: z.string().trim().min(2), description: z.string().trim().optional(), userId: z.number().int().optional(),
  discountType: z.enum(['percent', 'fixed']).default('percent'), discountValue: z.coerce.number().positive(), minSpend: z.coerce.number().min(0).default(0),
  category: z.string().trim().optional(), firstVisitOnly: z.boolean().default(false), maxUses: z.number().int().min(1).default(1), expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})), wrap((req, res) => {
  const b = req.body;
  if (b.discountType === 'percent' && b.discountValue > 100) throw httpError(400, 'Percent cannot exceed 100.');
  const id = db.prepare('INSERT INTO offers (code,title,description,user_id,discount_type,discount_value,min_spend,category,first_visit_only,max_uses,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(b.code.toUpperCase(), b.title, b.description || null, b.userId || null, b.discountType, b.discountValue, b.minSpend, b.category || null, b.firstVisitOnly ? 1 : 0, b.maxUses, b.expiresAt || null).lastInsertRowid;
  res.status(201).json(db.prepare('SELECT * FROM offers WHERE id = ?').get(id));
}));
r.patch('/admin/:id/active', auth, admin, wrap((req, res) => { db.prepare('UPDATE offers SET active = 1 - active WHERE id = ?').run(req.params.id); res.json({ ok: true }); }));
export default r;
