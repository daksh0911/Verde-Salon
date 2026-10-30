import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { notFound, errorHandler, apiLimiter, sameOriginOnly, noStore } from './middleware.js';
import auth from './routes/auth.js';
import services from './routes/services.js';
import staff, { availability } from './routes/staff.js';
import appointments from './routes/appointments.js';
import offers from './routes/offers.js';
import waitlist from './routes/waitlist.js';
import reviews from './routes/reviews.js';
import contact from './routes/contact.js';
import gallery from './routes/gallery.js';
import admin from './routes/admin.js';
import staffPortal from './routes/staff_portal.js';

if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) await import('./seed.js'); // first run only

export const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY); // set when behind nginx/Render/etc. so rate limits see real client IPs
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'https:'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"], frameAncestors: ["'none'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
  } },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 15552000, includeSubDomains: true },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}));
app.use((req, res, next) => { res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()'); next(); });
app.use(express.json({ limit: '50kb', strict: true }), cookieParser()); // same-origin only; Vite proxies /api in dev
app.use('/api', noStore, apiLimiter, sameOriginOnly);
app.get('/api/health', (req, res) => res.json({ ok: true }));
for (const [p, r] of Object.entries({ auth, services, staff, availability, appointments, offers, waitlist, reviews, contact, gallery, admin, 'staff-portal': staffPortal })) app.use(`/api/${p}`, r);
app.use('/api', notFound);

const web = path.join(path.dirname(fileURLToPath(import.meta.url)), '../web');
app.use(express.static(web, { maxAge: '1h' }));
app.get('*', (req, res) => res.sendFile(path.join(web, 'index.html')));
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') app.listen(process.env.PORT || 5000, () => console.log(`Verdé running on http://localhost:${process.env.PORT || 5000}`));
