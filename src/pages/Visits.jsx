import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WA, clock, dayLabel, get, money, next14, patch, post, put, del, useGet, ymd } from '../api';
import { Empty, Field, useAct } from '../ui';

function Visit({ v, reviewed, reload }) {
  const act = useAct(), [mode, setMode] = useState(null), [d, setD] = useState(v.date), [slots, setSlots] = useState([]), [cs, setCs] = useState(v.consult || {}), [rate, setRate] = useState({ rating: 5, comment: '' });
  const booked = v.status === 'booked', today = v.date === ymd(new Date()), id = v._id;
  const find = async (date) => { setD(date); setSlots(await get(`/availability?staffId=${v.staff._id}&serviceIds=${v.services.map((s) => s._id)}&date=${date}${v.group_id ? `&ignoreGroup=${v.group_id}` : ''}`).catch(() => [])); };
  const run = (fn, ok) => async () => { if (await act(fn, ok) !== undefined) { setMode(null); reload(); } };
  return <article className="card stack">
    <div className="row between"><div><h3>{v.services.map((s) => s.name).join(' + ')}</h3><p className="hint">{dayLabel(v.date)} · {clock(v.start)}–{clock(v.end)} · with {v.staff.name}</p></div><div className="row">{v.checkedIn && booked && <span className="badge in">Checked in</span>}<span className={`badge ${v.status}`}>{v.status}</span></div></div>
    <p>{money(v.final_amount)}{v.offer_code && <span className="hint"> · offer {v.offer_code} applied</span>}{v.deposit && <span className="hint"> · deposit {money(v.deposit.amount)} {v.deposit.status}</span>}</p>
    {booked && v.patch === 'needed' && <p className="note">Patch test needed at least 48 hours before this visit (free, about 10 minutes). Drop by or <a href={WA + encodeURIComponent('Hi Verdé, I would like to book a patch test')} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)' }}>message us on WhatsApp</a>.</p>}
    {booked && v.patch === 'done' && <p className="hint">Patch test done ✓</p>}
    {booked && <div className="row">
      {today && !v.checkedIn && <button className="btn sm" onClick={run(() => patch(`/appointments/${id}/check-in`), 'Checked in. See you in a moment.')}>I’m here</button>}
      <button className="btn ghost sm" onClick={() => setMode(mode === 'consult' ? null : 'consult')}>Consultation card</button>
      <button className="btn ghost sm" onClick={() => { setMode(mode === 'move' ? null : 'move'); find(v.date); }}>Reschedule</button>
      <button className="btn danger sm" onClick={() => confirm('Cancel this visit? Inside 4 hours, a deposit is kept.') && run(async () => { const r = await patch(`/appointments/${id}/cancel`); if (r.lateCancel) alert('Cancelled late: any deposit is kept.'); return r; }, 'Visit cancelled')()}>Cancel</button></div>}
    {mode === 'consult' && <div className="note">{['hairType', 'allergies', 'goal', 'inspoUrl'].map((k) => <Field key={k} label={k.replace(/([A-Z])/g, ' $1')}><input value={cs[k] || ''} onChange={(e) => setCs({ ...cs, [k]: e.target.value })} /></Field>)}<button className="btn sm" style={{ marginTop: 12 }} onClick={run(() => put(`/appointments/${id}/consult`, Object.fromEntries(Object.entries(cs).filter(([k, x]) => x && ['hairType', 'allergies', 'goal', 'inspoUrl', 'notes'].includes(k)))), 'Saved for your stylist')}>Save</button></div>}
    {mode === 'move' && <div className="note"><div className="chips days">{next14().map((x) => <button key={x} className={`chip${d === x ? ' on' : ''}`} onClick={() => find(x)}>{dayLabel(x)}</button>)}</div>
      <div className="chips" style={{ marginTop: 12 }}>{slots.filter((s) => s.available).map((s) => <button key={s.start} className="chip" onClick={run(() => put(`/appointments/${id}/reschedule`, { date: d, start: s.start }), 'Moved')}>{clock(s.start)}</button>)}{!slots.some((s) => s.available) && <span className="hint">No free times that day.</span>}</div></div>}
    {v.status === 'completed' && !reviewed && (mode === 'review' ? <div className="note"><div className="chips">{[1, 2, 3, 4, 5].map((n) => <button key={n} className={`chip${rate.rating === n ? ' on' : ''}`} onClick={() => setRate({ ...rate, rating: n })}>{n} ★</button>)}</div>
      <textarea style={{ marginTop: 10 }} rows={2} placeholder="How was your visit?" value={rate.comment} onChange={(e) => setRate({ ...rate, comment: e.target.value })} /><button className="btn sm" style={{ marginTop: 10 }} onClick={run(async () => { const r = await post('/reviews', { appointmentId: id, ...rate }); if (r.shareOnGoogle) alert('Thank you! We’d love it if you also shared this on Google.'); return r; }, 'Thank you for your feedback')}>Send</button></div>
      : <button className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={() => setMode('review')}>Rate this visit</button>)}
  </article>;
}

export default function Visits() {
  const [vs, reload] = useGet('/appointments/my'), [wl, reloadWl] = useGet('/waitlist/my'), [rv] = useGet('/reviews/my'), act = useAct();
  const reviewed = new Set(rv?.map((r) => r.appointmentId));
  const colour = vs?.filter((x) => x.status === 'completed' && x.services.some((s) => s.category === 'Colour')).sort((a, b) => b.date.localeCompare(a.date))[0];
  const weeks = colour && Math.floor((Date.now() - new Date(`${colour.date}T00:00`)) / 6048e5), booking = vs?.some((x) => x.status === 'booked' && x.services.some((s) => s.category === 'Colour'));
  const upcoming = vs?.filter((v) => v.status === 'booked').reverse(), past = vs?.filter((v) => v.status !== 'booked');
  return <div className="wrap page"><div className="row between"><h1 style={{ fontSize: 'clamp(40px,6vw,72px)' }}>My visits</h1><Link className="btn" to="/book">Book a visit</Link></div>
    {colour && !booking && weeks >= 5 && <section className="card refresh" style={{ marginTop: 24 }}><div className="row between"><div><p className="eyebrow" style={{ margin: 0 }}>Time for a refresh</p><h3 style={{ fontSize: 22, margin: '4px 0' }}>It has been {weeks} weeks since your colour</h3><p className="hint">Colour looks its best when freshened around week 6 to 8. Same stylist, one tap.</p></div><Link className="btn" to={`/book?service=${colour.services.find((s) => s.category === 'Colour')._id}&stylist=${colour.staff._id}`}>Rebook</Link></div></section>}
    {wl?.length > 0 && <section style={{ marginTop: 28 }}><h2 style={{ fontSize: 28 }}>Waitlist</h2><div className="stack">{wl.map((w) => <div key={w.id} className="card row between"><div><b>{w.service_name}</b> · {dayLabel(w.date)}{w.status === 'offered' ? <p style={{ color: 'var(--ok)' }}>A time opened at {clock(w.offered_start)} with {w.offered_staff_name}. Book it before it goes.</p> : <p className="hint">Waiting for a free time</p>}</div>
      <div className="row">{w.status === 'offered' && <Link className="btn sm" to={`/book?service=${w.service_id}&stylist=${w.offered_staff}`}>Book it</Link>}<button className="btn ghost sm" onClick={async () => { await act(() => del(`/waitlist/${w.id}`)); reloadWl(); }}>Leave</button></div></div>)}</div></section>}
    <h2 style={{ fontSize: 28, margin: '30px 0 14px' }}>Upcoming</h2><div className="stack">{upcoming?.map((v) => <Visit key={v._id} v={v} reload={reload} />)}{upcoming?.length === 0 && <Empty>Nothing booked yet.</Empty>}</div>
    <h2 style={{ fontSize: 28, margin: '36px 0 14px' }}>History</h2><div className="stack">{past?.map((v) => <Visit key={v._id} v={v} reviewed={reviewed.has(v._id)} reload={reload} />)}{past?.length === 0 && <Empty>Your history will appear here.</Empty>}</div></div>;
}
