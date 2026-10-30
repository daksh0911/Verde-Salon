# Verdé

Salon booking system: React + Express + SQLite (Node's built-in `node:sqlite`, so there is nothing native to compile).

## Run
Needs **Node 22.5 or newer**.
```bash
npm run setup      # installs frontend + server dependencies
npm start          # builds the site and starts everything on http://localhost:5000
```
Development with hot reload: `npm run server` in one terminal, `npm run dev` in another (open http://localhost:5173).
Tests: `npm test`. Copy `server/.env.example` to `server/.env` and set a real `JWT_SECRET` (required in production).

## Demo logins (created on first run; `npm run seed --prefix server` wipes and reseeds)
| Role | Email | Password |
|---|---|---|
| Owner | admin@verde.test | Admin@12345 |
| Front desk | desk@verde.test | Desk@12345 |
| Stylist | meera@verde.test | Stylist@12345 |
| Client | client@verde.test | Client@12345 |

## What's inside
- **Booking**: multi-service visits, "any available stylist", live slots, waitlist when a day is full, deposits for long services, private offers.
- **Before the visit**: consultation card (hair type, allergies, goal, inspiration link) the stylist reads; client notes (colour formulas).
- **On the day**: client taps "I'm here", front desk sees it; stylists and front desk mark done / no-show; deposits recorded as cash or UPI.
- **After**: points are earned on completed visits only; redeem for private rewards; referrals; birthday treat. Reviews of 1-3 stars go to the owner first.
- **Owner tools**: today view, stats, win-back list (WhatsApp link), services, team (creates stylist logins with a one-time password), offers, messages, leave and time off.
- **Roles**: client, stylist, reception (no revenue), owner.

## Images
Service, stylist and gallery pictures are illustrations in `public/img/` (referenced from `server/seed.js`). Replace them with your own photoshoot by putting files in `public/` and pointing the seed (or the admin screens) at them, then `npm run seed --prefix server`. Hero: `public/hero.jpg`.

## Layout
`server/` (API: `db.js` schema, `slots.js` availability, `routes/`), `src/` (React: `pages/`, `styles.css` tokens), `web/` (build output, generated).

## Guest-friendly extras
- **Find my look** (`/match`): a 3-question quiz that suggests a service and stylist, then opens booking pre-filled.
- **Patch-test safety**: colour bookings show a reminder to the client; the stylist or front desk taps "Patch test done" and it stays valid for 180 days. Change which categories need one in `server/db.js` (`PATCH_CATEGORIES`).
- **Time for a refresh**: after a colour visit, the client's *My visits* page offers one-tap rebooking from week 5.
- **Before/after slider** on the home page (gallery items from the owner tools; only with client consent).
- **Installable**: add the site to a phone home screen (`public/manifest.webmanifest`).
- **Phone friendly**: tested at 320-768px wide; full-width menu, thumb-sized buttons, 16px inputs (no iOS zoom), tables become cards, notch-safe edges. Fields use the right phone keyboards.
- **Motion**: gentle fade-ins on public pages, hero movement, button and card hover effects. Everything switches off for visitors who prefer reduced motion.

## Security & privacy
- **Sessions**: HttpOnly, SameSite=Lax, Secure (in production) cookie; token pinned to HS256 and tied to the password, so changing a password signs out other devices.
- **CSRF**: state-changing API calls with a foreign `Origin` are rejected.
- **Passwords**: bcrypt cost 12, 8-72 chars with a letter and a number; login does equal work for unknown emails.
- **Abuse limits**: 300 requests/min per IP overall; sign-in/registration limited per IP + email; contact form limited per hour.
- **Input**: every body is schema-validated; user-supplied links must be `https://` (no `javascript:`/`data:`); JSON body capped at 50 KB.
- **Headers**: strict CSP (`frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`), HSTS, Permissions-Policy, no-referrer-leak policy, `Cache-Control: no-store` on all API responses, `X-Powered-By` removed.
- **Privacy**: `/privacy` and `/cookies` pages, a cookie notice, and a required consent checkbox at sign-up (also enforced by the API). **Edit `src/legal.js`** with your real business name, address and privacy email before launch.
- **Deploying**: set `NODE_ENV=production`, a long random `JWT_SECRET`, and `TRUST_PROXY=1` behind a reverse proxy; serve over HTTPS only; back up `server/verde.db`.
