import { db, isoDate, nowMin } from './db.js';
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const dow = (date) => (new Date(`${date}T00:00`).getDay() + 6) % 7; // Mon=0

// 30-minute start times inside working hours; a slot is unavailable if it overlaps a booking or time off.
// ignoreGroup: the visit being rescheduled must not block itself.
export function freeSlots(staff, date, duration, { ignoreGroup = null, ignoreId = 0 } = {}) {
  if (!staff || !staff.active || date < isoDate() || !staff.days[dow(date)]) return [];
  const booked = db.prepare(`SELECT start_min s, end_min e FROM appointments WHERE staff_id = ? AND date = ? AND status IN ('booked','completed')
    AND id != ? AND (? IS NULL OR group_id IS NULL OR group_id != ?)`).all(staff._id, date, ignoreId, ignoreGroup, ignoreGroup);
  for (const t of db.prepare('SELECT start_min s, end_min e FROM time_off WHERE staff_id = ? AND date = ?').all(staff._id, date)) {
    booked.push({ s: t.s ?? 0, e: t.e ?? 1440 });
  }
  const out = [], today = date === isoDate(), now = nowMin();
  for (let m = staff.from * 60; m + duration <= staff.to * 60; m += 30) {
    if (today && m <= now) continue;
    out.push({ start: m, time: hhmm(m), available: !booked.some((b) => m < b.e && b.s < m + duration) });
  }
  return out;
}
export const offersService = (staff, serviceIds) => serviceIds.every((id) => staff.services.includes(id));
