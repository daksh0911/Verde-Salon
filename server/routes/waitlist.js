import { Router } from 'express';
import { z } from 'zod';
import { db, getService, isoDate } from '../db.js';
import { auth, validate, wrap, httpError } from '../middleware.js';
const r = Router();
r.get('/my', auth, wrap((req, res) => res.json(db.prepare(`SELECT w.*, s.name service_name, st.name offered_staff_name FROM waitlist w JOIN services s ON s.id = w.service_id LEFT JOIN staff st ON st.id = w.offered_staff
  WHERE w.customer_id = ? AND w.status IN ('waiting','offered') AND w.date >= ? ORDER BY w.date`).all(req.user.id, isoDate()))));
r.post('/', auth, validate(z.object({ serviceId: z.number().int(), staffId: z.number().int().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), fromMin: z.number().int().min(0).max(1439).default(0), toMin: z.number().int().min(1).max(1440).default(1440) })), wrap((req, res) => {
  const b = req.body;
  if (b.date < isoDate()) throw httpError(400, 'Choose a future date.');
  if (!getService(b.serviceId)?.active) throw httpError(404, 'Service not found.');
  if (db.prepare("SELECT 1 FROM waitlist WHERE customer_id=? AND service_id=? AND date=? AND status IN ('waiting','offered')").get(req.user.id, b.serviceId, b.date)) throw httpError(409, 'You are already on the waitlist for that day.');
  const id = db.prepare('INSERT INTO waitlist (customer_id,service_id,staff_id,date,from_min,to_min) VALUES (?,?,?,?,?,?)').run(req.user.id, b.serviceId, b.staffId || null, b.date, b.fromMin, b.toMin).lastInsertRowid;
  res.status(201).json({ id });
}));
r.delete('/:id', auth, wrap((req, res) => { db.prepare("UPDATE waitlist SET status='expired' WHERE id=? AND customer_id=?").run(req.params.id, req.user.id); res.json({ ok: true }); }));
export default r;
