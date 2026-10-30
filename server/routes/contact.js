import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { auth, admin, validate, wrap, httpError, publicFormLimiter } from '../middleware.js';
const r = Router();
const row = (m) => ({ _id: m.id, name: m.name, email: m.email, phone: m.phone, message: m.message, read: !!m.is_read, createdAt: m.created_at });
r.post('/', publicFormLimiter, validate(z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), phone: z.string().trim().max(20).optional(), message: z.string().trim().min(10).max(1000) })), wrap((req, res) => {
  const b = req.body; db.prepare('INSERT INTO messages (name,email,phone,message) VALUES (?,?,?,?)').run(b.name, b.email, b.phone || null, b.message); res.status(201).json({ ok: true });
}));
r.get('/', auth, admin, wrap((req, res) => res.json(db.prepare('SELECT * FROM messages ORDER BY id DESC').all().map(row))));
r.patch('/:id/read', auth, admin, wrap((req, res) => { const m = db.prepare('SELECT * FROM messages WHERE id=?').get(req.params.id); if (!m) throw httpError(404, 'Message not found.'); db.prepare('UPDATE messages SET is_read = 1 - is_read WHERE id=?').run(m.id); res.json({ ok: true }); }));
r.delete('/:id', auth, admin, wrap((req, res) => { db.prepare('DELETE FROM messages WHERE id=?').run(req.params.id); res.json({ ok: true }); }));
export default r;
