import bcrypt from 'bcryptjs';
import { db } from './db.js';
// Safe by default: refuses to touch a database that already has users unless run with --force.
if (db.prepare('SELECT 1 FROM users LIMIT 1').get() && !process.argv.includes('--force')) { console.log('Database already has data. Use `npm run seed` to wipe and reseed.'); process.exit(0); }
for (const t of ['before_after', 'client_notes', 'waitlist', 'offer_redemptions', 'offers', 'loyalty_ledger', 'payments', 'reviews', 'time_off', 'appointments', 'staff_services', 'staff', 'services', 'users']) db.exec(`DELETE FROM ${t}`);
db.exec('DELETE FROM sqlite_sequence');

const user = db.prepare('INSERT INTO users (name,email,phone,password,role,referral_code) VALUES (?,?,?,?,?,?)');
const pw = (p) => bcrypt.hashSync(p, 12);
user.run('Salon Owner', 'admin@verde.test', '9999999999', pw('Admin@12345'), 'admin', null);
const demo = user.run('Demo Client', 'client@verde.test', '9876543210', pw('Client@12345'), 'customer', 'VERDE-DEMO01').lastInsertRowid;
db.prepare("INSERT INTO offers (code,title,description,user_id,discount_type,discount_value,first_visit_only,expires_at) VALUES ('WELCOME-DEMO','Welcome to Verdé','15% off your first visit',?, 'percent', 15, 1, date('now','+60 day'))").run(demo);

const svc = db.prepare('INSERT INTO services (name,description,duration,price,category,image,gender,deposit_pct) VALUES (?,?,?,?,?,?,?,?)');
const S = [
  // 6 Women services
  ['Signature Cut & Blowdry', 'Consultation, botanical wash, tailored cut and bouncy blow-dry.', 50, 1100, 'Hair', '/img/svc-women-cut.jpg', 'women', 0],
  ['Balayage & Gloss Finish', 'Bespoke hand-painted highlights with a high-shine gloss glaze.', 150, 4500, 'Colour', '/img/svc-women-colour.jpg', 'women', 30],
  ['Hydra-Glow Facial', 'Deep ultrasonic cleanse, gentle fruit acid peel and lymphatic massage.', 60, 1800, 'Skin', '/img/svc-women-facial.jpg', 'women', 0],
  ['Restorative Hair Spa', 'Intense moisture mask, warm steam, scalp and shoulder relaxation.', 60, 1400, 'Spa', '/img/svc-women-spa.jpg', 'women', 0],
  ['Artisan Gel Manicure', 'Detailed cuticle architecture, hand scrub and chip-free gel polish.', 50, 1200, 'Nails', '/img/svc-women-nails.jpg', 'women', 0],
  ['Bridal & Couture Glam', 'Full radiance skin prep, couture bridal styling and setting.', 180, 9500, 'Bridal', '/img/svc-women-bridal.jpg', 'women', 40],

  // 6 Men services
  ['Men’s Classic Scissor & Fade Cut', 'Precision clipper/scissor work, neck taper, invigorating wash and style.', 40, 750, 'Hair', '/img/svc-men-cut.jpg', 'men', 0],
  ['Beard Sculpt & Hot Towel Trim', 'Razor line-up, steam infusion, beard balm conditioning and shaping.', 35, 550, 'Beard', '/img/svc-men-beard.jpg', 'men', 0],
  ['Men’s Grey Blending & Colour', 'Natural, subtle grey camouflaging and dimension tone.', 60, 1600, 'Colour', '/img/svc-men-colour.jpg', 'men', 20],
  ['Charcoal Deep-Pore Facial', 'Active charcoal extraction, blackhead removal and refreshing mask.', 50, 1400, 'Skin', '/img/svc-men-facial.jpg', 'men', 0],
  ['Scalp Detox & Head Massage', 'Herbal oil scalp stimulation, pressure point therapy and steam.', 45, 950, 'Spa', '/img/svc-men-spa.jpg', 'men', 0],
  ['Executive Hand & Nail Grooming', 'Clean nail buffing, cuticle tidying and revitalizing hand massage.', 40, 800, 'Nails', '/img/svc-men-manicure.jpg', 'men', 0],
].map((s) => svc.run(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]).lastInsertRowid);

const stylist = (name, role, bio, avatarId, exp, email, services) => {
  const uid = user.run(name, email, null, pw('Stylist@12345'), 'staff', null).lastInsertRowid;
  const sid = db.prepare('INSERT INTO staff (user_id,name,role,bio,avatar,experience,specialization,from_hour,to_hour) VALUES (?,?,?,?,?,?,?,10,19)').run(uid, name, role, bio, `/img/staff-${avatarId}.svg`, exp, role).lastInsertRowid;
  services.forEach((i) => db.prepare('INSERT INTO staff_services VALUES (?,?)').run(sid, S[i]));
};
stylist('Meera Shah', 'Creative Director, Colour', 'Eight years shaping colour that grows out beautifully.', 'meera', 8, 'meera@verde.test', [0, 1, 3, 8]);
stylist('Aarav Patel', 'Senior Stylist', 'Precision cutting and men’s grooming with a calm chair-side manner.', 'aarav', 6, 'aarav@verde.test', [0, 6, 7, 8, 9, 10, 11]);
stylist('Isha Desai', 'Skin & Bridal Artist', 'Skin-first makeup and bridal planning from trial to wedding morning.', 'isha', 7, 'isha@verde.test', [2, 4, 5, 9, 11]);

db.prepare("INSERT INTO offers (code,title,description,discount_type,discount_value,min_spend,max_uses) VALUES ('VERDE10','Friends of Verdé','10% off, one use per code','percent',10,500,50)").run();
const ba = db.prepare('INSERT INTO before_after (title,category,stylist_name,before_image,after_image) VALUES (?,?,?,?,?)');
ba.run('Women’s Sunlit Balayage & Gloss Transformation', 'Colour', 'Meera Shah', '/img/ba-new-women-before.jpg', '/img/ba-new-women-after.jpg');
ba.run('Men’s Precision Fade & Beard Sculpt Transformation', 'Grooming', 'Aarav Patel', '/img/ba-new-men-before.jpg', '/img/ba-new-men-after.jpg');
console.log('Seeded. Logins: admin@verde.test / Admin@12345, desk@verde.test / Desk@12345, client@verde.test / Client@12345, meera@verde.test / Stylist@12345');
