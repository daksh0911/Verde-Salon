import { Router } from 'express';
import { z } from 'zod';
import { db, svcOf, getService } from '../db.js';
import { auth, admin, validate, wrap, httpError, imageUrl } from '../middleware.js';
const r = Router();
const body = z.object({
  name: z.string().trim().min(2), description: z.string().trim().optional(),
  duration: z.coerce.number().int().min(15).max(300), price: z.coerce.number().positive(), active: z.boolean().optional(),
  category: z.string().trim().min(2).optional(), image: imageUrl.optional().or(z.literal('')), depositPct: z.coerce.number().int().min(0).max(100).optional(),
  gender: z.enum(['men', 'women', 'unisex']).optional(),
});
r.get('/', wrap((req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  const { category, gender } = req.query;
  let sql = 'SELECT * FROM services WHERE active=1';
  const params = [];
  if (category && category !== 'All') {
    sql += ' AND LOWER(category)=LOWER(?)';
    params.push(category);
  }
  if (gender && gender !== 'all') {
    sql += ' AND (gender=? OR gender="unisex")';
    params.push(gender);
  }
  sql += ' ORDER BY category,name';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(svcOf));
}));
r.get('/all', auth, admin, wrap((req, res) => res.json(db.prepare('SELECT * FROM services ORDER BY category,name').all().map(svcOf))));
r.post('/', auth, admin, validate(body), wrap((req, res) => {
  const b = req.body;
  const id = db.prepare('INSERT INTO services (name,description,duration,price,active,category,image,gender,deposit_pct) VALUES (?,?,?,?,?,?,?,?,?)').run(b.name, b.description || null, b.duration, b.price, b.active === false ? 0 : 1, b.category || 'Hair', b.image || null, b.gender || 'unisex', b.depositPct || 0).lastInsertRowid;
  res.status(201).json(getService(id));
}));
r.put('/:id', auth, admin, validate(body.partial()), wrap((req, res) => {
  const cur = getService(req.params.id); if (!cur) throw httpError(404, 'Service not found.');
  const b = { ...cur, ...req.body };
  db.prepare('UPDATE services SET name=?,description=?,duration=?,price=?,active=?,category=?,image=?,gender=?,deposit_pct=? WHERE id=?').run(b.name, b.description || null, b.duration, b.price, b.active ? 1 : 0, b.category, b.image || null, b.gender || cur.gender || 'unisex', b.depositPct ?? cur.depositPct, cur._id);
  res.json(getService(cur._id));
}));
r.delete('/:id', auth, admin, wrap((req, res) => {
  if (db.prepare('SELECT 1 FROM appointments WHERE service_id = ?').get(req.params.id)) throw httpError(409, 'This service has appointments. Hide it instead.');
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id); res.json({ ok: true });
}));
export default r;
