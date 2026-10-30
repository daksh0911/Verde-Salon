import { Router } from 'express';
import { db, userOf, isoDate } from '../db.js';
import { auth, admin, wrap } from '../middleware.js';
const r = Router();
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
// Overview & analytics for the salon owner/admin
r.get('/overview', auth, admin, wrap((req, res) => {
  const today = isoDate();
  const one = (sql, ...a) => db.prepare(sql).pluck().get(...a);
  const visits = (extra, ...a) => one(`SELECT COUNT(DISTINCT COALESCE(group_id,id)) FROM appointments WHERE ${extra}`, ...a);
  const out = {
    stats: {
      todayVisits: visits("date = ? AND status != 'cancelled'", today), checkedIn: visits("date = ? AND status='booked' AND checked_in_at IS NOT NULL", today),
      waitlistOpen: one("SELECT COUNT(*) FROM waitlist WHERE status IN ('waiting','offered') AND date >= ?", today),
      unreadMessages: one('SELECT COUNT(*) FROM messages WHERE is_read = 0'), privateReviews: one('SELECT COUNT(*) FROM reviews WHERE public = 0'),
      customers: one("SELECT COUNT(*) FROM users WHERE role='customer'"), activeStylists: one('SELECT COUNT(*) FROM staff WHERE active=1'),
      noShows30: visits("status='no-show' AND date >= ?", addDays(-30)),
      todayRevenue: one("SELECT COALESCE(SUM(final_amount),0) FROM appointments WHERE date=? AND status IN ('booked','completed')", today),
      revenue30: one("SELECT COALESCE(SUM(final_amount),0) FROM appointments WHERE status='completed' AND date >= ?", addDays(-30)),
    },
    popular: db.prepare("SELECT s.name, COUNT(*) bookings, COALESCE(SUM(a.final_amount),0) revenue FROM appointments a JOIN services s ON s.id=a.service_id WHERE a.status IN ('booked','completed') GROUP BY s.id ORDER BY bookings DESC LIMIT 5").all(),
    chart: [...Array(7)].map((_, i) => { const d = addDays(i - 6); return { date: d, revenue: one("SELECT COALESCE(SUM(final_amount),0) FROM appointments WHERE date=? AND status IN ('booked','completed')", d), visits: visits("date=? AND status != 'cancelled'", d) }; })
  };
  res.json(out);
}));
r.get('/customers', auth, admin, wrap((req, res) => res.json(db.prepare(`SELECT u.*, COUNT(DISTINCT COALESCE(a.group_id,a.id)) visits,
  COALESCE(SUM(CASE WHEN a.status='completed' THEN a.final_amount END),0) spent,
  COUNT(DISTINCT CASE WHEN a.status='no-show' THEN COALESCE(a.group_id,a.id) END) no_shows, MAX(a.date) last_visit
  FROM users u LEFT JOIN appointments a ON a.customer_id=u.id WHERE u.role='customer' GROUP BY u.id ORDER BY u.id DESC`).all()
  .map((u) => ({ ...userOf(u), visits: u.visits, totalSpent: u.spent, noShows: u.no_shows, lastVisit: u.last_visit })))));
// Win-back list: clients who haven't visited in 45+ days (ready to message)
r.get('/winback', auth, admin, wrap((req, res) => res.json(db.prepare(`SELECT u.id, u.name, u.phone, MAX(a.date) last_visit FROM users u JOIN appointments a ON a.customer_id=u.id AND a.status='completed'
  WHERE u.role='customer' GROUP BY u.id HAVING last_visit < ? AND NOT EXISTS (SELECT 1 FROM appointments b WHERE b.customer_id=u.id AND b.status='booked') ORDER BY last_visit`).all(addDays(-45)))));
r.get('/payments', auth, admin, wrap((req, res) => res.json(db.prepare('SELECT p.*, u.name customer FROM payments p JOIN users u ON u.id=p.customer_id ORDER BY p.id DESC LIMIT 100').all())));
export default r;
