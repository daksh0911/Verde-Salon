import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { db, staffOf, getStaff, getService, isoDate } from '../db.js';
import { auth, admin, staff as staffOnly, validate, wrap, httpError, imageUrl } from '../middleware.js';
import { freeSlots, offersService } from '../slots.js';
import { notifyWaitlist } from '../waitlist.js';

const r = Router();
const body = z.object({
  name: z.string().trim().min(2), email: z.string().trim().email().optional(), phone: z.string().trim().optional(),
  role: z.string().trim().max(60).optional(), bio: z.string().trim().max(300).optional(), services: z.array(z.number().int()).optional(),
  days: z.array(z.boolean()).length(7).optional(), from: z.number().int().min(0).max(23).optional(), to: z.number().int().min(1).max(24).optional(),
  avatar: imageUrl.optional().or(z.literal('')), experience: z.coerce.number().int().min(0).max(60).optional(), specialization: z.string().trim().max(80).optional(), active: z.boolean().optional(),
});
const setServices = (id, ids = []) => { db.prepare('DELETE FROM staff_services WHERE staff_id = ?').run(id); ids.forEach((s) => db.prepare('INSERT OR IGNORE INTO staff_services VALUES (?,?)').run(id, s)); };
const hoursOk = (b) => { if (b.from >= b.to) throw httpError(400, 'Opening time must be before closing time.'); };
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Public list: active stylists only (inactive ones are hidden from clients)
r.get('/', wrap((req, res) => {
  const rows = req.query.serviceId
    ? db.prepare('SELECT st.* FROM staff st JOIN staff_services ss ON ss.staff_id = st.id WHERE ss.service_id = ? AND st.active = 1 ORDER BY st.name').all(req.query.serviceId)
    : db.prepare('SELECT * FROM staff WHERE active = 1 ORDER BY name').all();
  res.json(rows.map(staffOf));
}));
r.get('/all', auth, admin, wrap((req, res) => res.json(db.prepare('SELECT * FROM staff ORDER BY name').all().map(staffOf))));

// Admin creates the stylist and their login; a one-time temporary password is returned (never a fixed default).
r.post('/', auth, admin, validate(body), wrap((req, res) => {
  const b = { role: 'Stylist', bio: '', services: [], days: [true, true, true, true, true, true, false], from: 10, to: 19, avatar: '', experience: 1, active: true, ...req.body };
  hoursOk(b);
  let tempPassword = null;
  const id = db.transaction(() => {
    let userId = null;
    if (b.email) {
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(b.email)) throw httpError(409, 'That email is already registered.');
      tempPassword = crypto.randomBytes(5).toString('base64url');
      userId = db.prepare("INSERT INTO users (name,email,phone,password,role) VALUES (?,?,?,?, 'staff')").run(b.name, b.email.toLowerCase(), b.phone || null, bcrypt.hashSync(tempPassword, 12)).lastInsertRowid;
    }
    const sid = db.prepare('INSERT INTO staff (user_id,name,role,bio,days,from_hour,to_hour,avatar,experience,specialization,active) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(userId, b.name, b.role, b.bio, JSON.stringify(b.days.map(Number)), b.from, b.to, b.avatar, b.experience, b.specialization || b.role, b.active ? 1 : 0).lastInsertRowid;
    setServices(sid, b.services); return sid;
  })();
  res.status(201).json({ ...getStaff(id), tempPassword });
}));
r.put('/:id', auth, admin, validate(body.partial()), wrap((req, res) => {
  const cur = getStaff(req.params.id); if (!cur) throw httpError(404, 'Stylist not found.');
  const b = { ...cur, ...req.body }; hoursOk(b);
  db.transaction(() => {
    db.prepare('UPDATE staff SET name=?,role=?,bio=?,days=?,from_hour=?,to_hour=?,avatar=?,experience=?,specialization=?,active=? WHERE id=?')
      .run(b.name, b.role, b.bio || '', JSON.stringify(b.days.map(Number)), b.from, b.to, b.avatar || '', b.experience, b.specialization || b.role, b.active ? 1 : 0, cur._id);
    if (req.body.services) setServices(cur._id, req.body.services);
  })();
  res.json(getStaff(cur._id));
}));
r.delete('/:id', auth, admin, wrap((req, res) => {
  if (db.prepare('SELECT 1 FROM appointments WHERE staff_id = ?').get(req.params.id)) throw httpError(409, 'This stylist has appointment history. Deactivate instead.');
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id); res.json({ ok: true });
}));

// ---- Leave / breaks (admin for anyone, staff for themselves). Blocks if it would clash with a booking. ----
const myStaffId = (req) => (req.user.role === 'admin' ? null : db.prepare('SELECT id FROM staff WHERE user_id = ?').pluck().get(req.user.id));
r.get('/:id/time-off', auth, wrap((req, res) => {
  if (req.user.role !== 'admin' && myStaffId(req) !== Number(req.params.id)) throw httpError(403, 'Not allowed.');
  res.json(db.prepare('SELECT * FROM time_off WHERE staff_id = ? AND date >= ? ORDER BY date').all(req.params.id, isoDate()));
}));
r.post('/:id/time-off', auth, validate(z.object({ date: ymd, startMin: z.number().int().min(0).max(1439).optional(), endMin: z.number().int().min(1).max(1440).optional(), reason: z.string().trim().max(100).optional() })), wrap((req, res) => {
  const sid = Number(req.params.id);
  if (req.user.role !== 'admin' && myStaffId(req) !== sid) throw httpError(403, 'Not allowed.');
  const { date, startMin = 0, endMin = 1440, reason } = req.body;
  if (startMin >= endMin) throw httpError(400, 'Start must be before end.');
  const clash = db.prepare("SELECT COUNT(DISTINCT COALESCE(group_id,id)) c FROM appointments WHERE staff_id=? AND date=? AND status='booked' AND start_min < ? AND end_min > ?").pluck().get(sid, date, endMin, startMin);
  if (clash) throw httpError(409, `${clash} booked visit(s) fall in that time. Reassign or cancel them first.`);
  const id = db.prepare('INSERT INTO time_off (staff_id,date,start_min,end_min,reason) VALUES (?,?,?,?,?)').run(sid, date, startMin, endMin, reason || null).lastInsertRowid;
  res.status(201).json({ id });
}));
r.delete('/:id/time-off/:toId', auth, wrap((req, res) => {
  if (req.user.role !== 'admin' && myStaffId(req) !== Number(req.params.id)) throw httpError(403, 'Not allowed.');
  const t = db.prepare('SELECT date FROM time_off WHERE id=? AND staff_id=?').get(req.params.toId, req.params.id);
  db.prepare('DELETE FROM time_off WHERE id=? AND staff_id=?').run(req.params.toId, req.params.id);
  if (t) notifyWaitlist(t.date);
  res.json({ ok: true });
}));

// ---- Availability ----
export const availability = Router();
const parseIds = (q) => String(q.serviceIds || q.serviceId || '').split(',').map(Number).filter(Boolean);
availability.get('/', wrap((req, res) => {
  const { staffId, date, ignoreGroup } = req.query, ids = parseIds(req.query);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw httpError(400, 'date must be YYYY-MM-DD');
  const st = getStaff(staffId); if (!st) throw httpError(404, 'Stylist not found.');
  const svcs = ids.map(getService); if (!svcs.length || svcs.some((s) => !s)) throw httpError(404, 'Services not found.');
  if (!offersService(st, ids)) throw httpError(400, 'This stylist does not offer all selected services.');
  res.json(freeSlots(st, date, svcs.reduce((a, s) => a + s.duration, 0), { ignoreGroup: ignoreGroup || null }));
}));
// "Any available stylist": first free time per stylist who can do everything selected
availability.get('/any', wrap((req, res) => {
  const { date } = req.query, ids = parseIds(req.query);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw httpError(400, 'date must be YYYY-MM-DD');
  const svcs = ids.map(getService); if (!svcs.length || svcs.some((s) => !s)) throw httpError(404, 'Services not found.');
  const dur = svcs.reduce((a, s) => a + s.duration, 0), merged = new Map();
  for (const row of db.prepare('SELECT id FROM staff WHERE active = 1 ORDER BY name').all()) {
    const st = getStaff(row.id); if (!offersService(st, ids)) continue;
    for (const s of freeSlots(st, date, dur)) if (s.available && !merged.has(s.start)) merged.set(s.start, { start: s.start, time: s.time, staffId: st._id, staffName: st.name });
  }
  res.json([...merged.values()].sort((a, b) => a.start - b.start));
}));
// Live status for the home page: open now? next free chair?
availability.get('/live', wrap((req, res) => {
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes(), d = (now.getDay() + 6) % 7;
  const all = db.prepare('SELECT * FROM staff WHERE active = 1').all().map(staffOf);
  const onDuty = all.filter((s) => s.days[d] && m >= s.from * 60 && m < s.to * 60);
  let next = null;
  for (const s of all) { const hit = freeSlots(s, isoDate(), 30).find((x) => x.available); if (hit && (!next || hit.start < next.start)) next = { start: hit.start, time: hit.time, staff: s.name }; }
  res.set('Cache-Control', 'public, max-age=30').json({ openNow: onDuty.length > 0, stylistsOnDuty: onDuty.length, nextFree: next });
}));
export default r;
