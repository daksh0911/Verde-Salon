import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { db, getService, getStaff, getAppt, listAppts, groupAppts, isoDate, nowMin } from '../db.js';
import { auth, validate, wrap, httpError, staffOrAdmin, httpsUrl } from '../middleware.js';
import { freeSlots, offersService } from '../slots.js';
import { checkOffer } from '../offers.js';
import { notifyWaitlist } from '../waitlist.js';
const r = Router();
const LATE_CANCEL_MIN = 4 * 60; // inside 4h: deposit is kept
const when = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), start: z.number().int().min(0).max(1439) });
const consult = z.object({
  hairType: z.string().trim().max(40).optional(), goal: z.string().trim().max(300).optional(), allergies: z.string().trim().max(200).optional(),
  inspoUrl: httpsUrl.optional().or(z.literal('')), notes: z.string().trim().max(500).optional(),
}).strict();
const isDesk = (u) => u.role === 'admin';

const rowsOf = (id) => {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
  if (!a) throw httpError(404, 'Appointment not found.');
  return { a, rows: a.group_id ? db.prepare('SELECT * FROM appointments WHERE group_id = ? ORDER BY start_min').all(a.group_id) : [a] };
};
const own = (req) => { const x = rowsOf(req.params.id); if (!isDesk(req.user) && x.a.customer_id !== req.user.id) throw httpError(403, 'This is not your appointment.'); return x; };
const staffCan = (req, a) => {
  if (isDesk(req.user)) return true;
  const sid = db.prepare('SELECT id FROM staff WHERE user_id = ?').pluck().get(req.user.id);
  return req.user.role === 'staff' && sid === a.staff_id;
};
const startOfVisit = (rows) => rows[0].start_min;

r.post('/', auth, validate(when.extend({
  serviceIds: z.array(z.number().int()).min(1, 'Choose at least one service').max(5),
  staffId: z.number().int(), offerCode: z.string().trim().optional(), consult: consult.optional(),
})), wrap((req, res) => {
  if (req.user.role !== 'customer') throw httpError(403, 'Only client accounts can book online. Use the front desk for walk-ins.');
  const { serviceIds, staffId, date, start, offerCode, consult: cs } = req.body;
  const services = serviceIds.map(getService);
  if (services.some((s) => !s || !s.active) || new Set(serviceIds).size !== serviceIds.length) throw httpError(404, 'One or more services are not available.');
  const staff = getStaff(staffId);
  if (!staff || !staff.active) throw httpError(404, 'Stylist not found.');
  if (!offersService(staff, serviceIds)) throw httpError(400, 'This stylist does not offer all of the selected services.');
  const duration = services.reduce((a, s) => a + s.duration, 0), total = services.reduce((a, s) => a + s.price, 0);

  const id = db.transaction(() => {
    const slot = freeSlots(staff, date, duration).find((s) => s.start === start);
    if (!slot || !slot.available) throw httpError(409, 'That time is no longer available. Please pick another.');
    const gid = 'V-' + crypto.randomBytes(5).toString('hex');
    let discount = 0, offer = null;
    if (offerCode) { ({ offer, discount } = checkOffer(offerCode, req.user.id, services)); }
    const final = Math.max(0, total - discount);
    let cur = start, first = null;
    services.forEach((s) => {
      const share = total ? Math.round((s.price / total) * discount) : 0; // rounding remainder goes to the first row below
      const row = db.prepare('INSERT INTO appointments (customer_id,service_id,staff_id,group_id,date,start_min,end_min,offer_code,discount_amount,final_amount,consult) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(req.user.id, s._id, staffId, gid, date, cur, cur + s.duration, offer?.code || null, share, Math.max(0, s.price - share), cs ? JSON.stringify(cs) : null);
      first ??= row.lastInsertRowid; cur += s.duration;
    });
    const drift = discount - services.reduce((a, s) => a + Math.round((s.price / total) * discount), 0);
    if (drift) db.prepare('UPDATE appointments SET discount_amount = discount_amount + ?, final_amount = final_amount - ? WHERE id = ?').run(drift, drift, first);
    if (offer) { db.prepare('INSERT INTO offer_redemptions (offer_id,user_id,group_id) VALUES (?,?,?)').run(offer.id, req.user.id, gid); db.prepare('UPDATE offers SET used_count = used_count + 1 WHERE id = ?').run(offer.id); }
    const deposit = Math.round(services.reduce((a, s) => a + (s.price * s.depositPct) / 100, 0) * (total ? (final / total) : 1));
    if (deposit > 0) db.prepare("INSERT INTO payments (group_id,customer_id,amount,kind,status) VALUES (?,?,?,'deposit','pending')").run(gid, req.user.id, deposit);
    db.prepare("UPDATE waitlist SET status='booked' WHERE customer_id=? AND date=? AND status IN ('waiting','offered')").run(req.user.id, date);
    return first;
  })();
  const [visit] = groupAppts(listAppts('a.id = ? OR a.group_id = (SELECT group_id FROM appointments WHERE id = ?)', [id, id]));
  const payment = db.prepare('SELECT * FROM payments WHERE group_id = ?').get(visit.group_id) || null;
  res.status(201).json({ ...visit, deposit: payment && { amount: payment.amount, status: payment.status } });
}));

const mine = (req) => groupAppts(listAppts('a.customer_id = ?', [req.user.id])).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
r.get('/my', auth, wrap((req, res) => res.json(mine(req).map((v) => ({ ...v, deposit: db.prepare('SELECT amount,status FROM payments WHERE group_id = ?').get(v.group_id) || null })))));

// Front desk: the day at a glance, with check-in state (also the live queue)
r.get('/today', auth, staffOrAdmin, wrap((req, res) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : isoDate();
  let where = 'a.date = ?', args = [date];
  if (req.user.role === 'staff') { where += ' AND a.staff_id = (SELECT id FROM staff WHERE user_id = ?)'; args.push(req.user.id); }
  res.json(groupAppts(listAppts(where, args)).map((v) => ({ ...v, deposit: db.prepare('SELECT amount,status FROM payments WHERE group_id = ?').get(v.group_id) || null })));
}));
r.get('/', auth, staffOrAdmin, wrap((req, res) => {
  if (req.user.role === 'staff') throw httpError(403, 'Use the staff portal.');
  const w = ['1=1'], args = [];
  for (const [k, col] of [['date', 'a.date'], ['staff', 'a.staff_id'], ['status', 'a.status']]) if (req.query[k]) { w.push(`${col} = ?`); args.push(req.query[k]); }
  res.json(groupAppts(listAppts(w.join(' AND '), args)).reverse());
}));

r.put('/:id/reschedule', auth, validate(when), wrap((req, res) => {
  const { a, rows } = own(req);
  if (a.status !== 'booked') throw httpError(400, 'Only booked appointments can be moved.');
  const staff = getStaff(a.staff_id), svcs = rows.map((x) => getService(x.service_id));
  const duration = svcs.reduce((s, x) => s + x.duration, 0);
  db.transaction(() => {
    const slot = freeSlots(staff, req.body.date, duration, { ignoreGroup: a.group_id, ignoreId: a.group_id ? 0 : a.id }).find((s) => s.start === req.body.start);
    if (!slot || !slot.available) throw httpError(409, 'That time is not available. Choose another slot.');
    let cur = req.body.start;
    rows.forEach((row, i) => { db.prepare('UPDATE appointments SET date=?, start_min=?, end_min=?, checked_in_at=NULL WHERE id=?').run(req.body.date, cur, cur + svcs[i].duration, row.id); cur += svcs[i].duration; });
  })();
  notifyWaitlist(a.date);
  res.json(getAppt(a.id));
}));

r.patch('/:id/cancel', auth, wrap((req, res) => {
  const { a, rows } = own(req);
  if (a.status !== 'booked') throw httpError(400, 'Only booked appointments can be cancelled.');
  const minsAway = (new Date(`${a.date}T00:00`).getTime() - new Date(`${isoDate()}T00:00`).getTime()) / 6e4 + startOfVisit(rows) - nowMin();
  const late = minsAway < LATE_CANCEL_MIN && !isDesk(req.user);
  db.transaction(() => {
    db.prepare("UPDATE appointments SET status='cancelled' WHERE " + (a.group_id ? 'group_id = ?' : 'id = ?')).run(a.group_id || a.id);
    if (a.group_id) {
      const dep = db.prepare("SELECT * FROM payments WHERE group_id = ? AND kind='deposit'").get(a.group_id);
      if (dep && !late) db.prepare(dep.status === 'paid' ? "UPDATE payments SET status='refunded' WHERE id=?" : 'DELETE FROM payments WHERE id=?').run(dep.id);
      if (a.offer_code && !late) { // give the offer back
        const o = db.prepare('SELECT id FROM offers WHERE code = ?').get(a.offer_code);
        if (o) { db.prepare('DELETE FROM offer_redemptions WHERE offer_id=? AND group_id=?').run(o.id, a.group_id); db.prepare('UPDATE offers SET used_count = MAX(0, used_count - 1) WHERE id=?').run(o.id); }
      }
    }
  })();
  notifyWaitlist(a.date);
  res.json({ ...getAppt(a.id), lateCancel: late });
}));

// "I'm here": client taps on arrival, front desk sees it instantly
r.patch('/:id/check-in', auth, wrap((req, res) => {
  const { a, rows } = own(req);
  if (a.status !== 'booked') throw httpError(400, 'This appointment is not active.');
  if (a.date !== isoDate() || nowMin() < startOfVisit(rows) - 60) throw httpError(400, 'Check-in opens one hour before your appointment.');
  db.prepare('UPDATE appointments SET checked_in_at = CURRENT_TIMESTAMP WHERE ' + (a.group_id ? 'group_id = ?' : 'id = ?')).run(a.group_id || a.id);
  res.json(getAppt(a.id));
}));

// Pre-visit consultation card the stylist reads before the client sits down
r.put('/:id/consult', auth, validate(consult), wrap((req, res) => {
  const { a } = own(req);
  if (a.status !== 'booked') throw httpError(400, 'Consultation can only be edited before the visit.');
  db.prepare('UPDATE appointments SET consult = ? WHERE ' + (a.group_id ? 'group_id = ?' : 'id = ?')).run(JSON.stringify(req.body), a.group_id || a.id);
  res.json(getAppt(a.id));
}));

r.put('/:id/assign', auth, validate(z.object({ staffId: z.coerce.number().int() })), wrap((req, res) => {
  if (!isDesk(req.user)) throw httpError(403, 'Front desk only.');
  const { a, rows } = rowsOf(req.params.id), st = getStaff(req.body.staffId);
  if (!st || !st.active) throw httpError(404, 'Stylist not found.');
  const svcIds = rows.map((x) => x.service_id), duration = rows.reduce((s, x) => s + (x.end_min - x.start_min), 0);
  if (!offersService(st, svcIds)) throw httpError(400, 'That stylist does not offer these services.');
  const slot = freeSlots(st, a.date, duration, { ignoreGroup: a.group_id, ignoreId: a.group_id ? 0 : a.id }).find((s) => s.start === rows[0].start_min);
  if (a.status === 'booked' && (!slot || !slot.available)) throw httpError(409, 'That stylist is not free at this time.');
  db.prepare('UPDATE appointments SET staff_id = ? WHERE ' + (a.group_id ? 'group_id = ?' : 'id = ?')).run(st._id, a.group_id || a.id);
  res.json(getAppt(a.id));
}));

const POINTS = (final) => Math.max(10, Math.floor(final / 10));
// Stylist or front desk confirms the client's patch test was done today.
r.patch('/:id/patch-test', auth, staffOrAdmin, wrap((req, res) => {
  const { a } = rowsOf(req.params.id);
  if (!staffCan(req, a)) throw httpError(403, 'You are not assigned to this appointment.');
  db.prepare('UPDATE users SET patch_test_on = ? WHERE id = ?').run(isoDate(), a.customer_id);
  res.json({ ok: true });
}));
r.patch('/:id/status', auth, staffOrAdmin, validate(z.object({ status: z.enum(['booked', 'completed', 'cancelled', 'no-show']) })), wrap((req, res) => {
  const { a, rows } = rowsOf(req.params.id);
  if (!staffCan(req, a)) throw httpError(403, 'You are not assigned to this appointment.');
  const next = req.body.status;
  if (next === 'completed' && new Date(`${a.date}T00:00`).getTime() + startOfVisit(rows) * 6e4 > Date.now()) throw httpError(400, 'A visit cannot be completed before its start time.');
  if (next === 'booked') {
    const staff = getStaff(a.staff_id), dur = rows.reduce((s, x) => s + (x.end_min - x.start_min), 0);
    const slot = freeSlots(staff, a.date, dur, { ignoreGroup: a.group_id, ignoreId: a.group_id ? 0 : a.id }).find((s) => s.start === rows[0].start_min);
    if (!slot || !slot.available) throw httpError(409, 'That time is no longer free.');
  }
  db.transaction(() => {
    db.prepare('UPDATE appointments SET status = ? WHERE ' + (a.group_id ? 'group_id = ?' : 'id = ?')).run(next, a.group_id || a.id);
    const gid = a.group_id || `S${a.id}`, final = rows.reduce((s, x) => s + x.final_amount, 0);
    if (next === 'completed') {
      db.prepare("INSERT OR IGNORE INTO loyalty_ledger (user_id,points,reason,group_id) VALUES (?,?, 'visit', ?)").run(a.customer_id, POINTS(final), gid);
      const ref = db.prepare('SELECT referred_by FROM users WHERE id = ?').pluck().get(a.customer_id);
      const firstDone = db.prepare("SELECT COUNT(DISTINCT COALESCE(group_id,id)) c FROM appointments WHERE customer_id=? AND status='completed'").pluck().get(a.customer_id) === 1;
      if (ref && firstDone) {
        db.prepare("INSERT OR IGNORE INTO loyalty_ledger (user_id,points,reason,group_id) VALUES (?,100,'referral',?)").run(ref, gid);
        db.prepare("INSERT OR IGNORE INTO loyalty_ledger (user_id,points,reason,group_id) VALUES (?,100,'referred-welcome',?)").run(a.customer_id, gid);
      }
    } else db.prepare("DELETE FROM loyalty_ledger WHERE group_id = ? AND reason IN ('visit','referral','referred-welcome')").run(gid);
  })();
  if (['cancelled', 'no-show'].includes(next)) notifyWaitlist(a.date);
  res.json(getAppt(a._id ?? a.id));
}));

// Front desk records money received (deposit or balance)
r.patch('/:id/payment', auth, validate(z.object({ method: z.enum(['cash', 'upi', 'card']), status: z.enum(['paid', 'pending']).default('paid') })), wrap((req, res) => {
  if (!isDesk(req.user)) throw httpError(403, 'Front desk only.');
  const { a } = rowsOf(req.params.id);
  if (!a.group_id) throw httpError(400, 'No deposit on this booking.');
  const p = db.prepare("SELECT id FROM payments WHERE group_id = ? AND kind='deposit'").get(a.group_id);
  if (!p) throw httpError(404, 'This booking has no deposit.');
  db.prepare('UPDATE payments SET method=?, status=? WHERE id=?').run(req.body.method, req.body.status, p.id);
  res.json({ ok: true });
}));
export default r;
