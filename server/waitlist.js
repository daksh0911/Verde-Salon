import { db, getStaff, getService } from './db.js';
import { freeSlots } from './slots.js';
// Called whenever a booking is cancelled or moved: offer the freed time to the first matching waiting client.
export function notifyWaitlist(date) {
  const waiting = db.prepare("SELECT * FROM waitlist WHERE date = ? AND status = 'waiting' ORDER BY id").all(date);
  for (const w of waiting) {
    const svc = getService(w.service_id); if (!svc) continue;
    const staffIds = w.staff_id ? [w.staff_id] : db.prepare('SELECT staff_id FROM staff_services WHERE service_id = ?').pluck().all(w.service_id);
    for (const sid of staffIds) {
      const st = getStaff(sid);
      const hit = freeSlots(st, date, svc.duration).find((s) => s.available && s.start >= w.from_min && s.start + svc.duration <= w.to_min);
      if (hit) { db.prepare("UPDATE waitlist SET status='offered', offered_start=?, offered_staff=? WHERE id=?").run(hit.start, sid, w.id); break; }
    }
  }
}
