import { Router } from 'express';
import { z } from 'zod';
import { db, listAppts, groupAppts, getStaff, svcOf, isoDate } from '../db.js';
import { auth, staff, validate, wrap, httpError } from '../middleware.js';
const r = Router();
// No fallbacks: a staff login without a linked profile gets an error, never someone else's data.
const me = (req) => { const row = db.prepare('SELECT id FROM staff WHERE user_id = ?').get(req.user.id); if (!row) throw httpError(404, 'No stylist profile is linked to this account. Ask the admin.'); return getStaff(row.id); };
r.use(auth, staff);
r.get('/dashboard', wrap((req, res) => {
  const s = me(req), today = isoDate(), all = groupAppts(listAppts('a.staff_id = ?', [s._id]));
  const todays = all.filter((v) => v.date === today && v.status !== 'cancelled');
  res.json({ staff: s, stats: { today: todays.length, checkedIn: todays.filter((v) => v.checkedIn && v.status === 'booked').length, upcoming: all.filter((v) => v.status === 'booked' && v.date >= today).length },
    today: todays, assignedServices: db.prepare('SELECT s.* FROM services s JOIN staff_services ss ON ss.service_id=s.id WHERE ss.staff_id=?').all(s._id).map(svcOf) });
}));
r.get('/schedule', wrap((req, res) => res.json(me(req))));
r.put('/schedule', validate(z.object({ days: z.array(z.boolean()).length(7).optional(), from: z.number().int().min(0).max(23).optional(), to: z.number().int().min(1).max(24).optional() })), wrap((req, res) => {
  const s = me(req), b = { ...s, ...req.body };
  if (b.from >= b.to) throw httpError(400, 'Start must be before end.');
  // Don't strand booked visits on a day or hour that is being removed
  const rows = db.prepare("SELECT date, start_min, end_min FROM appointments WHERE staff_id=? AND status='booked' AND date >= ?").all(s._id, isoDate());
  for (const a of rows) { const d = (new Date(`${a.date}T00:00`).getDay() + 6) % 7; if (!b.days[d] || a.start_min < b.from * 60 || a.end_min > b.to * 60) throw httpError(409, `You have a booking on ${a.date} outside the new hours. Ask the front desk to move it first.`); }
  db.prepare('UPDATE staff SET days=?, from_hour=?, to_hour=? WHERE id=?').run(JSON.stringify(b.days.map(Number)), b.from, b.to, s._id);
  res.json(getStaff(s._id));
}));
// Client notes (colour formula, preferences). Visible only to staff who have served the client.
r.get('/clients/:id/notes', wrap((req, res) => {
  const s = me(req);
  if (!db.prepare('SELECT 1 FROM appointments WHERE staff_id=? AND customer_id=?').get(s._id, req.params.id)) throw httpError(403, 'You have not served this client.');
  res.json(db.prepare('SELECT n.*, st.name author FROM client_notes n LEFT JOIN staff st ON st.id=n.staff_id WHERE n.customer_id=? ORDER BY n.id DESC').all(req.params.id));
}));
r.post('/clients/:id/notes', validate(z.object({ note: z.string().trim().min(2).max(500) })), wrap((req, res) => {
  const s = me(req);
  if (!db.prepare('SELECT 1 FROM appointments WHERE staff_id=? AND customer_id=?').get(s._id, req.params.id)) throw httpError(403, 'You have not served this client.');
  db.prepare('INSERT INTO client_notes (customer_id,staff_id,note) VALUES (?,?,?)').run(req.params.id, s._id, req.body.note); res.status(201).json({ ok: true });
}));
export default r;
