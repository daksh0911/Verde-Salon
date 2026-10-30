import assert from 'node:assert';

const BASE = 'http://localhost:5000';

class Client {
  constructor(name) {
    this.name = name;
    this.cookie = null;
  }

  async req(method, path, body = null) {
    const headers = {
      'Content-Type': 'application/json',
      'Origin': BASE,
      'Referer': BASE + '/'
    };
    if (this.cookie) headers['Cookie'] = this.cookie;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const sessionCookie = rawCookies.find(c => c.startsWith('verde_session='));
    if (sessionCookie) {
      this.cookie = sessionCookie.split(';')[0];
    }

    return { status: res.status, ok: res.ok, data };
  }
}

async function runTests() {
  console.log('--- STARTING VERDE FULL CRUD & API TEST SUITE ---');

  // 1. Health check
  const anon = new Client('Anonymous');
  const h = await anon.req('GET', '/api/health');
  assert.strictEqual(h.status, 200, 'Health check failed');
  console.log('✓ Health check passed');

  // 2. Public Read endpoints
  const svcs = await anon.req('GET', '/api/services');
  assert.strictEqual(svcs.status, 200);
  assert(Array.isArray(svcs.data) && svcs.data.length > 0);
  console.log(`✓ Read Services passed (${svcs.data.length} services)`);

  const staff = await anon.req('GET', '/api/staff');
  assert.strictEqual(staff.status, 200);
  assert(Array.isArray(staff.data) && staff.data.length > 0);
  console.log(`✓ Read Staff passed (${staff.data.length} stylists)`);

  const live = await anon.req('GET', '/api/availability/live');
  assert.strictEqual(live.status, 200);
  console.log(`✓ Live status passed`);

  // 3. User Registration (Customer CRUD: Create)
  const custEmail = `cust_${Date.now()}@verde.test`;
  const cust = new Client('Customer');
  const reg = await cust.req('POST', '/api/auth/register', {
    name: 'Aisha Sharma',
    email: custEmail,
    phone: '9876543210',
    password: 'Password123!',
    consent: true
  });
  assert.strictEqual(reg.status, 201, `Register failed: ${JSON.stringify(reg.data)}`);
  assert(cust.cookie, 'Session cookie not saved on register');
  console.log(`✓ Customer Registration passed (ID: ${reg.data.id})`);

  // 4. Customer Read / Profile
  const me = await cust.req('GET', '/api/auth/me');
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.data.email, custEmail);
  console.log(`✓ Customer Read Profile passed`);

  // 5. Customer Update Profile
  const upd = await cust.req('PUT', '/api/auth/profile', {
    name: 'Aisha S. Patel',
    phone: '9876543211',
    birthday: '1995-05-15'
  });
  assert.strictEqual(upd.status, 200);
  assert.strictEqual(upd.data.name, 'Aisha S. Patel');
  console.log(`✓ Customer Update Profile passed`);

  // 6. Appointment Booking (Create)
  const targetService = svcs.data[0];
  const targetStaff = staff.data.find(s => s.services.includes(targetService._id));
  assert(targetStaff, 'Could not find a stylist providing service');

  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  const dateStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;

  const slots = await cust.req('GET', `/api/availability?staffId=${targetStaff._id}&serviceIds=${targetService._id}&date=${dateStr}`);
  assert.strictEqual(slots.status, 200);
  const freeSlot = slots.data.find(s => s.available);
  assert(freeSlot, 'No free slot found for booking test');

  const bookRes = await cust.req('POST', '/api/appointments', {
    serviceIds: [targetService._id],
    staffId: targetStaff._id,
    date: dateStr,
    start: freeSlot.start,
    consult: { hairType: 'Straight', goal: 'Healthy trim' }
  });
  assert.strictEqual(bookRes.status, 201, `Booking failed: ${JSON.stringify(bookRes.data)}`);
  const apptId = bookRes.data._id;
  console.log(`✓ Booking Create passed (Appt ID: ${apptId})`);

  // 7. Customer Read Bookings
  const myVisits = await cust.req('GET', '/api/appointments/my');
  assert.strictEqual(myVisits.status, 200);
  assert(myVisits.data.some(v => v._id === apptId));
  console.log(`✓ Customer Read Appointments passed`);

  // 8. Update Consultation / Reschedule
  const consultUpd = await cust.req('PUT', `/api/appointments/${apptId}/consult`, {
    hairType: 'Fine wavy',
    goal: 'Light layers'
  });
  assert.strictEqual(consultUpd.status, 200);
  console.log(`✓ Customer Update Consultation passed`);

  // 9. Cancel Appointment (Delete/Cancel flow)
  const cancelRes = await cust.req('PATCH', `/api/appointments/${apptId}/cancel`);
  assert.strictEqual(cancelRes.status, 200);
  console.log(`✓ Customer Cancel Appointment passed`);

  // 10. Admin Authentication & Management
  const admin = new Client('Admin');
  const adminLogin = await admin.req('POST', '/api/auth/login', {
    email: 'admin@verde.test',
    password: 'Admin@12345'
  });
  assert.strictEqual(adminLogin.status, 200, 'Admin login failed');
  console.log(`✓ Admin Login passed`);

  // 11. Admin Services CRUD
  // Create Service
  const newSvc = await admin.req('POST', '/api/services', {
    name: 'Custom Royal Glow Treatment',
    description: 'Exclusive rejuvenating gold facial ceremony.',
    duration: 60,
    price: 3200,
    category: 'Skin',
    gender: 'unisex',
    depositPct: 20
  });
  assert.strictEqual(newSvc.status, 201, `Create service failed: ${JSON.stringify(newSvc.data)}`);
  const createdSvcId = newSvc.data._id;
  console.log(`✓ Admin Service Create passed (Service ID: ${createdSvcId})`);

  // Read Service via public endpoint
  const checkSvcs = await anon.req('GET', '/api/services');
  assert(checkSvcs.data.some(s => s._id === createdSvcId));
  console.log(`✓ Admin Service Read in public catalog passed`);

  // Update Service
  const updSvc = await admin.req('PUT', `/api/services/${createdSvcId}`, {
    name: 'Custom Royal Glow Treatment (Updated)',
    price: 3500
  });
  assert.strictEqual(updSvc.status, 200);
  assert.strictEqual(updSvc.data.price, 3500);
  console.log(`✓ Admin Service Update passed`);

  // Delete Service
  const delSvc = await admin.req('DELETE', `/api/services/${createdSvcId}`);
  assert.strictEqual(delSvc.status, 200);
  console.log(`✓ Admin Service Delete passed`);

  // 12. Contact Form & Admin Message Management
  const contactMsg = await anon.req('POST', '/api/contact', {
    name: 'Dev Test',
    email: 'dev@example.com',
    phone: '9988776655',
    message: 'Testing system connectivity and notifications.'
  });
  assert.strictEqual(contactMsg.status, 201);
  console.log(`✓ Contact Message Send passed`);

  const msgList = await admin.req('GET', '/api/contact');
  assert.strictEqual(msgList.status, 200);
  const latestMsg = msgList.data.find(m => m.email === 'dev@example.com');
  assert(latestMsg, 'Message not found in admin inbox');
  console.log(`✓ Admin Read Messages passed`);

  const readToggle = await admin.req('PATCH', `/api/contact/${latestMsg._id}/read`);
  assert.strictEqual(readToggle.status, 200);
  console.log(`✓ Admin Mark Message Read passed`);

  const delMsg = await admin.req('DELETE', `/api/contact/${latestMsg._id}`);
  assert.strictEqual(delMsg.status, 200);
  console.log(`✓ Admin Delete Message passed`);

  // 13. Admin Overview & Operations Stats
  const overview = await admin.req('GET', '/api/admin/overview');
  assert.strictEqual(overview.status, 200);
  assert(overview.data.stats, 'Overview stats missing');
  console.log(`✓ Admin Overview & Analytics passed`);

  console.log('\n========================================');
  console.log('ALL CRUD & WEB SERVICE TESTS PASSED 100%!');
  console.log('========================================\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
