import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { auth, admin, validate, wrap, imageUrl } from '../middleware.js';
const r = Router();
r.get('/', wrap((req, res) => res.json(db.prepare('SELECT * FROM before_after ORDER BY id DESC').all())));
r.post('/admin', auth, admin, validate(z.object({ title: z.string().trim().min(2), category: z.string().trim().default('Hair'), stylist_name: z.string().trim().optional(), before_image: imageUrl, after_image: imageUrl, description: z.string().trim().optional() })), wrap((req, res) => {
  const b = req.body; const id = db.prepare('INSERT INTO before_after (title,category,stylist_name,before_image,after_image,description) VALUES (?,?,?,?,?,?)').run(b.title, b.category, b.stylist_name || null, b.before_image, b.after_image, b.description || null).lastInsertRowid;
  res.status(201).json(db.prepare('SELECT * FROM before_after WHERE id=?').get(id));
}));
r.delete('/admin/:id', auth, admin, wrap((req, res) => { db.prepare('DELETE FROM before_after WHERE id=?').run(req.params.id); res.json({ ok: true }); }));
export default r;
