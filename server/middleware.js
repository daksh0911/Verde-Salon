import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { db } from './db.js';

export const httpError = (status, message) => Object.assign(new Error(message), { status });
export const wrap = (fn) => async (req, res, next) => { try { await fn(req, res, next); } catch (e) { next(e); } };

const COOKIE = 'verde_session';
const prod = process.env.NODE_ENV === 'production';
// 'pv' fingerprints the current password hash, so changing a password signs out every other session.
const pv = (hash) => crypto.createHash('sha256').update(String(hash)).digest('hex').slice(0, 16);
const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: prod, path: '/' };
export const signIn = (res, u) => {
  const token = jwt.sign({ id: u.id, pv: pv(u.password) }, process.env.JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
  res.cookie(COOKIE, token, { ...cookieOpts, maxAge: 7 * 864e5 });
};
export const signOut = (res) => res.clearCookie(COOKIE, cookieOpts);

// Role is always re-read from the database, so removing a user or changing a role takes effect immediately.
export const auth = (req, res, next) => {
  try {
    const { id, pv: v } = jwt.verify(req.cookies?.[COOKIE] || '', process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const u = db.prepare('SELECT id, name, role, password FROM users WHERE id = ?').get(id);
    if (!u || v !== pv(u.password)) throw new Error('gone');
    req.user = { id: u.id, name: u.name, role: u.role }; next();
  } catch { next(httpError(401, 'Please log in to continue.')); }
};
const only = (...roles) => (req, res, next) => (roles.includes(req.user?.role) ? next() : next(httpError(403, 'You do not have access to this.')));
export const admin = only('admin');
export const staff = only('staff');
export const staffOrAdmin = only('staff', 'admin');

export const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return next(httpError(400, r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')));
  req.body = r.data; next();
};

// Limits are per IP + email, so one attacker cannot lock out everyone and one account cannot be hammered from many tabs.
const byIpAndEmail = (req) => `${req.ip}|${String(req.body?.email || '').toLowerCase().slice(0, 100)}`;
export const loginLimiter = rateLimit({ windowMs: 15 * 60e3, limit: 10, skipSuccessfulRequests: true, keyGenerator: byIpAndEmail, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Try again in a few minutes.' } });
export const apiLimiter = rateLimit({ windowMs: 60e3, limit: 300, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many requests. Please slow down.' } });

// ---- Shared hardening helpers ----
// Passwords: 8-72 chars (bcrypt ignores everything past 72 bytes), at least one letter and one number.
export const newPassword = z.string().min(8, 'Password needs at least 8 characters').max(72, 'Password can be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password needs at least one letter').regex(/\d/, 'Password needs at least one number');
// Links users can submit must be https:// (blocks javascript:, data: and plain http).
export const httpsUrl = z.string().trim().max(500).url().refine((u) => /^https:\/\//i.test(u), 'Link must start with https://');
// Images may also be one of our own files such as /hero.jpg.
export const imageUrl = z.string().trim().max(500).refine((u) => /^https:\/\/\S+$/i.test(u) || /^\/[\w./-]+$/.test(u), 'Image must be an https:// link or a site file');

// CSRF: SameSite=Lax already blocks most cross-site posts; this also rejects any state-changing request whose Origin is not this site.
export const sameOriginOnly = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // non-browser clients (curl, tests) send no Origin and carry no ambient cookies
  try { if (new URL(origin).host === req.get('host')) return next(); } catch { /* fall through */ }
  next(httpError(403, 'Cross-site request blocked.'));
};
// API responses hold personal data: never let a browser or proxy cache them.
export const noStore = (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };
export const publicFormLimiter = rateLimit({ windowMs: 60 * 60e3, limit: 8, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many messages. Please try later.' } });

export const notFound = (req, res, next) => next(httpError(404, 'Route not found.'));
export const errorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body must be valid JSON.' });
  if (/UNIQUE constraint/.test(err.message || '')) return res.status(409).json({ message: 'That email, code or time slot is already taken.' });
  if (/FOREIGN KEY|CHECK constraint/.test(err.message || '')) return res.status(400).json({ message: 'Invalid reference or value.' });
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Something went wrong on the server.' });
};
