import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { db, userOf, pointsOf } from '../db.js';
import { auth, validate, wrap, httpError, signIn, signOut, loginLimiter, newPassword, imageUrl } from '../middleware.js';
const r = Router();
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);
const view = (u) => ({ ...userOf(u), points: pointsOf(u.id), staffId: db.prepare('SELECT id FROM staff WHERE user_id = ?').pluck().get(u.id) ?? null });
const code = () => 'VERDE-' + crypto.randomBytes(3).toString('hex').toUpperCase();
const phone = z.string().trim().regex(/^[+\d][\d\s-]{7,15}$/, 'Enter a valid phone number');

// Customers only. Staff accounts are created by an admin (routes/staff.js); there is no public staff sign-up.
r.post('/register', loginLimiter, validate(z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80), email: z.string().trim().email('Enter a valid email').max(120),
  password: newPassword, phone: phone.optional(), consent: z.literal(true, { errorMap: () => ({ message: 'Please accept the Privacy Policy to create an account' }) }),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), referralCode: z.string().trim().max(20).optional(),
})), wrap((req, res) => {
  const { name, email, password, phone: ph, birthday, referralCode } = req.body;
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw httpError(409, 'That email is already registered. Log in instead.');
  const ref = referralCode ? db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode.toUpperCase()) : null;
  const id = db.transaction(() => {
    const uid = db.prepare("INSERT INTO users (name,email,phone,password,role,birthday,referral_code,referred_by) VALUES (?,?,?,?, 'customer', ?,?,?)")
      .run(name, email.toLowerCase(), ph || null, bcrypt.hashSync(password, 12), birthday || null, code(), ref?.id || null).lastInsertRowid;
    // Welcome offer is private to this account and valid for one first visit.
    db.prepare("INSERT INTO offers (code,title,description,user_id,discount_type,discount_value,first_visit_only,expires_at) VALUES (?,?,?,?, 'percent', 15, 1, date('now','+60 day'))")
      .run('WELCOME-' + uid + '-' + crypto.randomBytes(2).toString('hex').toUpperCase(), 'Welcome to Verdé', '15% off your first visit', uid);
    return uid;
  })();
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  signIn(res, u); res.status(201).json(view(u));
}));

r.post('/login', loginLimiter, validate(z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72) })), wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(req.body.email.toLowerCase());
  const ok = bcrypt.compareSync(req.body.password, u?.password || DUMMY_HASH); // same work whether or not the email exists
  if (!u || !ok) throw httpError(401, 'Email or password is incorrect.');
  signIn(res, u); res.json(view(u));
}));
r.post('/logout', (req, res) => { signOut(res); res.json({ ok: true }); });
r.get('/me', auth, wrap((req, res) => res.json(view(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)))));

r.put('/profile', auth, validate(z.object({ name: z.string().trim().min(2).max(80), phone: phone.optional().or(z.literal('')), birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')), avatar: imageUrl.optional().or(z.literal('')) })), wrap((req, res) => {
  const b = req.body;
  db.prepare('UPDATE users SET name=?, phone=?, birthday=?, avatar=? WHERE id=?').run(b.name, b.phone || null, b.birthday || null, b.avatar || null, req.user.id);
  res.json(view(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)));
}));
r.put('/password', auth, validate(z.object({ current: z.string().min(1).max(72), next: newPassword })), wrap((req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(req.body.current, u.password)) throw httpError(400, 'Current password is incorrect.');
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(bcrypt.hashSync(req.body.next, 12), u.id);
  signIn(res, { id: u.id, password: db.prepare('SELECT password FROM users WHERE id = ?').pluck().get(u.id) }); // other devices are signed out; this one stays in
  res.json({ ok: true });
}));
export default r;
