import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { auth, admin, validate, wrap, httpError } from '../middleware.js';
const r = Router();
const shape = (x) => ({ id: x.id, appointmentId: x.appointment_id, rating: x.rating, comment: x.comment, createdAt: x.created_at, customer: x.uname, serviceName: x.sname, stylistName: x.stname, public: !!x.public });
const Q = `SELECT r.*, u.name uname, s.name sname, st.name stname FROM reviews r JOIN users u ON u.id=r.customer_id JOIN services s ON s.id=r.service_id JOIN staff st ON st.id=r.staff_id`;
// Public feed: only reviews the owner has not held back. Powers the home page (no hardcoded quotes).
r.get('/', wrap((req, res) => res.json(db.prepare(`${Q} WHERE r.public = 1 AND r.rating >= 4 ORDER BY r.created_at DESC LIMIT ?`).all(Math.min(Number(req.query.limit) || 20, 50)).map(shape))));
r.get('/my', auth, wrap((req, res) => res.json(db.prepare(`${Q} WHERE r.customer_id = ? ORDER BY r.created_at DESC`).all(req.user.id).map(shape))));
// Private-first: 1-3 stars go to the owner first; 4-5 stars are published (and the client is invited to share on Google).
r.post('/', auth, validate(z.object({ appointmentId: z.coerce.number().int(), rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().min(3).max(600) })), wrap((req, res) => {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.body.appointmentId);
  if (!a || a.customer_id !== req.user.id) throw httpError(404, 'Appointment not found.');
  if (a.status !== 'completed') throw httpError(400, 'Only completed visits can be reviewed.');
  const first = a.group_id ? db.prepare('SELECT * FROM appointments WHERE group_id = ? ORDER BY start_min LIMIT 1').get(a.group_id) : a;
  const pub = req.body.rating >= 4 ? 1 : 0;
  db.prepare(`INSERT INTO reviews (appointment_id,customer_id,service_id,staff_id,rating,comment,public) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(appointment_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, public=excluded.public, created_at=CURRENT_TIMESTAMP`).run(first.id, req.user.id, first.service_id, first.staff_id, req.body.rating, req.body.comment, pub);
  res.status(201).json({ published: !!pub, shareOnGoogle: req.body.rating === 5 });
}));
r.get('/admin/private', auth, admin, wrap((req, res) => res.json(db.prepare(`${Q} WHERE r.public = 0 ORDER BY r.created_at DESC`).all().map(shape))));
r.patch('/admin/:id/publish', auth, admin, wrap((req, res) => { db.prepare('UPDATE reviews SET public = 1 - public WHERE id = ?').run(req.params.id); res.json({ ok: true }); }));
r.delete('/admin/:id', auth, admin, wrap((req, res) => { db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id); res.json({ ok: true }); }));
export default r;
