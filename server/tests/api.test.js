import { test, after } from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test'; process.env.DB_FILE = ':memory:'; process.env.JWT_SECRET = 'test-secret-test-secret';
const { app } = await import('../server.js');
const server = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
const base = `http://127.0.0.1:${server.address().port}`; const jar = {};
after(() => server.close());
const call = async (who, method, path, body) => {
  const r = await fetch(base + '/api' + path, { method, headers: { 'Content-Type': 'application/json', cookie: jar[who] || '' }, body: body && JSON.stringify(body) });
  const c = r.headers.get('set-cookie'); if (c) jar[who] = c.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => null) };
};
const login = (who, email, password) => call(who, 'POST', '/auth/login', { email, password });
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const weekday = () => { for (let i = 2; i < 9; i++) if (new Date(day(i) + 'T00:00').getDay() !== 0) return day(i); };

test('security basics', async () => {
  assert.equal((await call('x', 'POST', '/auth/staff-register', {})).status, 404);
  assert.equal((await call('anon', 'GET', '/admin/overview')).status, 401);
  assert.equal((await login('c', 'client@verde.test', 'Client@12345')).status, 200);
  assert.equal((await call('c', 'GET', '/admin/overview')).status, 403);
  assert.equal((await call('anon', 'GET', '/offers/mine')).status, 401);
});

test('booking: stylist must offer service, no double booking, offer rules, deposit', async () => {
  await login('c', 'client@verde.test', 'Client@12345'); const date = weekday();
  const staff = (await call('c', 'GET', '/staff')).body, aarav = staff.find((s) => s.name.startsWith('Aarav')), meera = staff.find((s) => s.name.startsWith('Meera'));
  const svcs = (await call('c', 'GET', '/services')).body, balayage = svcs.find((s) => s.name.startsWith('Balayage')), cut = svcs.find((s) => s.name.startsWith('Signature'));
  assert.equal((await call('c', 'POST', '/appointments', { serviceIds: [balayage._id], staffId: aarav._id, date, start: 600 })).status, 400);
  const ok = await call('c', 'POST', '/appointments', { serviceIds: [balayage._id], staffId: meera._id, date, start: 600 });
  assert.equal(ok.status, 201, JSON.stringify(ok.body)); assert.equal(ok.body.deposit.status, 'pending'); assert.equal(ok.body.deposit.amount, 1260);
  assert.equal((await call('c', 'POST', '/appointments', { serviceIds: [cut._id], staffId: meera._id, date, start: 660 })).status, 409);
  const welcome = (await call('c', 'GET', '/offers/mine')).body[0];
  assert.equal((await call('c', 'POST', '/appointments', { serviceIds: [cut._id], staffId: meera._id, date, start: 780, offerCode: welcome.code })).status, 400); // first-visit-only
  const shared = await call('c', 'POST', '/appointments', { serviceIds: [cut._id], staffId: meera._id, date, start: 780, offerCode: 'verde10' });
  assert.equal(shared.status, 201); assert.equal(shared.body.final_amount, 720);
});

test('loyalty is earned on completion only, and cancel returns deposit', async () => {
  await login('c', 'client@verde.test', 'Client@12345'); await login('a', 'admin@verde.test', 'Admin@12345');
  assert.equal((await call('c', 'GET', '/offers/loyalty')).body.points, 0);
  const mine = (await call('c', 'GET', '/appointments/my')).body, bal = mine.find((v) => v.deposit);
  const cancel = await call('c', 'PATCH', `/appointments/${bal._id}/cancel`);
  assert.equal(cancel.status, 200); assert.equal((await call('c', 'GET', '/appointments/my')).body.find((v) => v._id === bal._id).deposit, null);
  assert.equal((await call('c', 'PATCH', `/appointments/${mine.find((v) => v.status === 'booked' && !v.deposit)._id}/status`, { status: 'completed' })).status, 403);
  assert.equal((await call('a', 'PATCH', `/appointments/${mine[0]._id}/status`, { status: 'completed' })).status, 400); // future visit
});

test('no-show is a valid status and waitlist works', async () => {
  await login('a', 'admin@verde.test', 'Admin@12345'); await login('c', 'client@verde.test', 'Client@12345');
  const mine = (await call('c', 'GET', '/appointments/my')).body.find((v) => v.status === 'booked');
  assert.equal((await call('a', 'PATCH', `/appointments/${mine._id}/status`, { status: 'no-show' })).status, 200);
  const svc = (await call('c', 'GET', '/services')).body[0];
  assert.equal((await call('c', 'POST', '/waitlist', { serviceId: svc._id, date: weekday() })).status, 201);
  assert.equal((await call('c', 'POST', '/waitlist', { serviceId: svc._id, date: weekday() })).status, 409);
});

test('hardening: consent, password policy, https-only links, CSRF, headers, session revocation', async () => {
  const reg = (o) => call('n', 'POST', '/auth/register', { name: 'New Person', email: 'new@verde.test', password: 'Fresh1234', ...o });
  assert.equal((await reg({})).status, 400);                                   // no consent
  assert.equal((await reg({ consent: true, password: 'allletters' })).status, 400); // no number
  assert.equal((await reg({ consent: true, password: 'a1'.repeat(40) })).status, 400); // over 72 chars
  assert.equal((await reg({ consent: true })).status, 201);
  assert.equal((await call('n', 'PUT', '/auth/profile', { name: 'New Person', avatar: 'javascript:alert(1)' })).status, 400);
  assert.equal((await call('n', 'PUT', '/auth/profile', { name: 'New Person', avatar: 'https://example.com/a.jpg' })).status, 200);
  // cross-site POST is rejected even with a valid session cookie
  const evil = await fetch(base + '/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', cookie: jar.n, origin: 'https://evil.example' }, body: JSON.stringify({ name: 'Hacked' }) });
  assert.equal(evil.status, 403);
  // security headers
  const h = await fetch(base + '/api/health');
  assert.equal(h.headers.get('cache-control'), 'no-store');
  assert.equal(h.headers.get('x-powered-by'), null);
  assert.match(h.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  // changing the password revokes other sessions
  const old = jar.n;
  assert.equal((await call('n', 'PUT', '/auth/password', { current: 'Fresh1234', next: 'Newer5678' })).status, 200);
  assert.equal((await fetch(base + '/api/auth/me', { headers: { cookie: old } })).status, 401);
  assert.equal((await call('n', 'GET', '/auth/me')).status, 200);
});

test('patch test: colour needs one, front desk can mark it done', async () => {
  await login('c', 'client@verde.test', 'Client@12345'); await login('a', 'admin@verde.test', 'Admin@12345');
  const date = weekday(), svcs = (await call('c', 'GET', '/services')).body, balayage = svcs.find((s) => s.name.startsWith('Balayage'));
  const meera = (await call('c', 'GET', '/staff')).body.find((s) => s.name.startsWith('Meera'));
  const b = await call('c', 'POST', '/appointments', { serviceIds: [balayage._id], staffId: meera._id, date, start: 840 });
  assert.equal(b.status, 201, JSON.stringify(b.body));
  const mine = () => call('c', 'GET', '/appointments/my').then((r) => r.body.find((v) => v.services.some((s) => s._id === balayage._id) && v.status === 'booked'));
  assert.equal((await mine()).patch, 'needed');
  const id = (await mine())._id;
  assert.equal((await call('c', 'PATCH', `/appointments/${id}/patch-test`)).status, 403); // clients cannot self-certify
  assert.equal((await call('a', 'PATCH', `/appointments/${id}/patch-test`)).status, 200);
  assert.equal((await mine()).patch, 'done');
});
