import 'dotenv/config';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  if (process.env.NODE_ENV === 'production') { console.error('JWT_SECRET (16+ chars) is required in production.'); process.exit(1); }
  process.env.JWT_SECRET = 'dev-only-' + Math.random().toString(36).slice(2) + Date.now(); // new each start in dev
}

const file = process.env.DB_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), 'verde.db');
const raw = new DatabaseSync(file);
raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// Thin wrapper: prepare().get/all/run/pluck + transaction(), so route code stays short.
let depth = 0;
export const db = {
  exec: (s) => raw.exec(s),
  prepare(sql) {
    const st = raw.prepare(sql);
    return {
      get: (...a) => st.get(...a), all: (...a) => st.all(...a), run: (...a) => st.run(...a),
      pluck: () => ({ all: (...a) => st.all(...a).map((r) => Object.values(r)[0]), get: (...a) => { const r = st.get(...a); return r && Object.values(r)[0]; } }),
    };
  },
  transaction: (fn) => (...args) => {
    const outer = depth++ === 0;
    if (outer) raw.exec('BEGIN IMMEDIATE');
    try { const r = fn(...args); if (outer) raw.exec('COMMIT'); return r; }
    catch (e) { if (outer) raw.exec('ROLLBACK'); throw e; }
    finally { depth--; }
  },
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT, password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin','staff')),
  avatar TEXT, birthday TEXT, referral_code TEXT UNIQUE, referred_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT,
  duration INTEGER NOT NULL, price REAL NOT NULL, active INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL DEFAULT 'Hair', image TEXT,
  gender TEXT NOT NULL DEFAULT 'unisex' CHECK (gender IN ('men','women','unisex')),
  deposit_pct INTEGER NOT NULL DEFAULT 0 CHECK (deposit_pct BETWEEN 0 AND 100));

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id), name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Stylist', bio TEXT, days TEXT NOT NULL DEFAULT '[1,1,1,1,1,1,0]',
  from_hour INTEGER NOT NULL DEFAULT 10, to_hour INTEGER NOT NULL DEFAULT 19, avatar TEXT,
  experience INTEGER NOT NULL DEFAULT 1, specialization TEXT, active INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS staff_services (
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE, PRIMARY KEY (staff_id, service_id));

-- Leave / breaks: a whole day (start_min NULL) or part of a day
CREATE TABLE IF NOT EXISTS time_off (
  id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL, start_min INTEGER, end_min INTEGER, reason TEXT);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES users(id), service_id INTEGER NOT NULL REFERENCES services(id), staff_id INTEGER NOT NULL REFERENCES staff(id),
  group_id TEXT, date TEXT NOT NULL, start_min INTEGER NOT NULL, end_min INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','completed','cancelled','no-show')),
  offer_code TEXT, discount_amount REAL NOT NULL DEFAULT 0, final_amount REAL NOT NULL DEFAULT 0,
  checked_in_at TEXT, consult TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_booked ON appointments (staff_id, date, start_min) WHERE status = 'booked';
CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments (date, staff_id);
CREATE INDEX IF NOT EXISTS idx_appt_customer ON appointments (customer_id);

-- Deposits and payments are real records: pending until the front desk marks them paid.
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, group_id TEXT NOT NULL, customer_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL, kind TEXT NOT NULL DEFAULT 'deposit' CHECK (kind IN ('deposit','balance')),
  method TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

-- Points live in a ledger so every change has a reason and can be reversed
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), points INTEGER NOT NULL,
  reason TEXT NOT NULL, group_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_reason ON loyalty_ledger (user_id, reason, group_id) WHERE group_id IS NOT NULL;

-- Private offers: never listed publicly. user_id NULL = anyone holding the code.
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE COLLATE NOCASE, title TEXT NOT NULL, description TEXT,
  user_id INTEGER REFERENCES users(id), discount_type TEXT NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value REAL NOT NULL, min_spend REAL NOT NULL DEFAULT 0, category TEXT, first_visit_only INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER NOT NULL DEFAULT 1, used_count INTEGER NOT NULL DEFAULT 0, expires_at TEXT, active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS offer_redemptions (
  offer_id INTEGER NOT NULL REFERENCES offers(id), user_id INTEGER NOT NULL REFERENCES users(id), group_id TEXT NOT NULL,
  PRIMARY KEY (offer_id, group_id));

-- Waitlist: when a slot frees up, the first matching client is offered it
CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES users(id), service_id INTEGER NOT NULL REFERENCES services(id),
  staff_id INTEGER REFERENCES staff(id), date TEXT NOT NULL, from_min INTEGER NOT NULL DEFAULT 0, to_min INTEGER NOT NULL DEFAULT 1440,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','offered','booked','expired')), offered_start INTEGER, offered_staff INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id),
  customer_id INTEGER NOT NULL REFERENCES users(id), service_id INTEGER NOT NULL REFERENCES services(id), staff_id INTEGER NOT NULL REFERENCES staff(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), comment TEXT,
  public INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS client_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES users(id), staff_id INTEGER REFERENCES staff(id),
  note TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS before_after (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL, stylist_name TEXT,
  before_image TEXT NOT NULL, after_image TEXT NOT NULL, description TEXT);
`);

// ---------- local-time helpers (never use toISOString for "today") ----------
// Colour needs an allergy patch test at least 48h before; a passed test stays valid for 180 days.
try { raw.exec("ALTER TABLE services ADD COLUMN gender TEXT NOT NULL DEFAULT 'unisex'"); } catch { /* column already exists */ }
try { raw.exec('ALTER TABLE users ADD COLUMN patch_test_on TEXT'); } catch { /* column already exists */ }
export const PATCH_CATEGORIES = ['Colour'];
export const patchState = (cat, doneOn, apptDate) => {
  if (!PATCH_CATEGORIES.includes(cat)) return null;
  const days = doneOn ? (new Date(`${apptDate}T00:00`) - new Date(`${doneOn}T00:00`)) / 864e5 : -1;
  return days >= 0 && days <= 180 ? 'done' : 'needed';
};
export const isoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

// ---------- row mappers ----------
export const userOf = (r) => r && { id: r.id, name: r.name, email: r.email, phone: r.phone || '', role: r.role, avatar: r.avatar || '', birthday: r.birthday || '', referralCode: r.referral_code || '' };
export const pointsOf = (userId) => db.prepare('SELECT COALESCE(SUM(points),0) p FROM loyalty_ledger WHERE user_id = ?').get(userId).p;

export const svcOf = (r) => r && { _id: r.id, name: r.name, description: r.description || '', duration: r.duration, price: r.price, active: !!r.active, category: r.category || 'Hair', image: r.image || '', gender: r.gender || 'unisex', depositPct: r.deposit_pct || 0 };

export const ratingOf = (staffId) => {
  const x = db.prepare('SELECT ROUND(AVG(rating),1) a, COUNT(*) n FROM reviews WHERE staff_id = ? AND public = 1').get(staffId);
  return { rating: x.n ? x.a : null, reviewCount: x.n };
};

// publicSafe hides account links from anonymous visitors
export const staffOf = (r) => r && {
  _id: r.id, name: r.name, role: r.role, bio: r.bio || '', days: JSON.parse(r.days || '[1,1,1,1,1,1,0]').map(Boolean),
  from: r.from_hour, to: r.to_hour, avatar: r.avatar || '', experience: r.experience, specialization: r.specialization || r.role,
  active: r.active !== 0, ...ratingOf(r.id), services: db.prepare('SELECT service_id FROM staff_services WHERE staff_id = ?').pluck().all(r.id),
};

const APPT = `SELECT a.*, s.name sname, s.duration sdur, s.price sprice, s.category scat, st.name stname, st.role strole,
  u.name uname, u.email uemail, u.phone uphone, u.avatar uavatar, u.patch_test_on upatch
  FROM appointments a JOIN services s ON s.id = a.service_id JOIN staff st ON st.id = a.staff_id JOIN users u ON u.id = a.customer_id`;

export const apptOf = (r) => ({
  _id: r.id, group_id: r.group_id, date: r.date, start: r.start_min, end: r.end_min, status: r.status,
  offer_code: r.offer_code, discount_amount: r.discount_amount, final_amount: r.final_amount,
  checkedIn: !!r.checked_in_at, patch: patchState(r.scat, r.upatch, r.date), consult: r.consult ? JSON.parse(r.consult) : null, created_at: r.created_at,
  service: { _id: r.service_id, name: r.sname, duration: r.sdur, price: r.sprice, category: r.scat },
  staff: { _id: r.staff_id, name: r.stname, role: r.strole },
  customer: { _id: r.customer_id, name: r.uname, email: r.uemail, phone: r.uphone, avatar: r.uavatar },
});

export const getService = (id) => svcOf(db.prepare('SELECT * FROM services WHERE id = ?').get(id));
export const getStaff = (id) => staffOf(db.prepare('SELECT * FROM staff WHERE id = ?').get(id));
export const getAppt = (id) => { const r = db.prepare(`${APPT} WHERE a.id = ?`).get(id); return r && apptOf(r); };
export const listAppts = (where = '1=1', args = []) => db.prepare(`${APPT} WHERE ${where} ORDER BY a.date, a.start_min`).all(...args).map(apptOf);

// Rows booked together share a group_id; the UI works with one card per visit.
export function groupAppts(appts) {
  const map = new Map();
  for (const a of appts) {
    const key = a.group_id || `SINGLE-${a._id}`;
    const g = map.get(key);
    if (!g) map.set(key, { ...a, services: [a.service], apptIds: [a._id] });
    else { g.services.push(a.service); g.apptIds.push(a._id); g.end = Math.max(g.end, a.end); g.start = Math.min(g.start, a.start); g.patch = g.patch === 'needed' || a.patch === 'needed' ? 'needed' : g.patch || a.patch; g.final_amount += a.final_amount; g.discount_amount += a.discount_amount; }
  }
  return [...map.values()];
}
