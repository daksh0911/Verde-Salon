import { useState } from 'react';
import { clock, dayLabel, del, get, money, patch, post, put, useGet, ymd } from '../api';
import { useAuth } from '../auth';
import { Empty, Field, useAct } from '../ui';

const Today = ({ admin }) => {
  const [date, setDate] = useState(ymd(new Date())), [vs, reload] = useGet(`/appointments/today?date=${date}`), [team] = useGet('/staff'), act = useAct();
  const run = (fn, ok) => async () => { if (await act(fn, ok)) reload(); };
  return <><Field label="Date"><input type="date" style={{ maxWidth: 200 }} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
    <div className="tw" style={{ marginTop: 16 }}><table><thead><tr><th>Time</th><th>Client</th><th>Services</th><th>Stylist</th><th>Status</th><th>Actions</th></tr></thead><tbody>{vs?.map((v) => <tr key={v._id}>
      <td data-l="Time">{clock(v.start)}</td><td data-l="Client">{v.customer.name}<br /><span className="hint">{v.customer.phone}</span></td><td data-l="Services">{v.services.map((s) => s.name).join(' + ')}<br /><span className="hint">{money(v.final_amount)}</span></td>
      <td data-l="Stylist">{v.status === 'booked' ? <select value={v.staff._id} onChange={(e) => run(() => put(`/appointments/${v._id}/assign`, { staffId: Number(e.target.value) }), 'Stylist changed')()}>{team?.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}</select> : v.staff.name}</td>
      <td data-l="Status"><span className={`badge ${v.status}`}>{v.status}</span> {v.checkedIn && v.status === 'booked' && <span className="badge in">here</span>}{v.patch === 'needed' && v.status === 'booked' && <span className="badge warn">patch test</span>}{v.deposit && <p className="hint">deposit {money(v.deposit.amount)} {v.deposit.status}</p>}</td>
      <td><div className="row">{v.status === 'booked' && <>{v.patch === 'needed' && <button className="btn ghost sm" onClick={run(() => patch(`/appointments/${v._id}/patch-test`), 'Patch test recorded')}>Patch ✓</button>}<button className="btn sm" onClick={run(() => patch(`/appointments/${v._id}/status`, { status: 'completed' }), 'Completed')}>Done</button><button className="btn danger sm" onClick={run(() => patch(`/appointments/${v._id}/status`, { status: 'no-show' }), 'No-show')}>No-show</button><button className="btn ghost sm" onClick={run(() => patch(`/appointments/${v._id}/cancel`), 'Cancelled')}>Cancel</button></>}
        {v.deposit?.status === 'pending' && ['cash', 'upi'].map((m) => <button key={m} className="btn ghost sm" onClick={run(() => patch(`/appointments/${v._id}/payment`, { method: m }), 'Deposit recorded')}>Paid {m}</button>)}</div></td></tr>)}</tbody></table></div>{vs?.length === 0 && <Empty>No visits on {dayLabel(date)}.</Empty>}</>;
};

const Overview = ({ admin }) => {
  const [o] = useGet('/admin/overview'), [w] = useGet('/admin/winback'); if (!o) return null; const s = o.stats, max = Math.max(1, ...(o.chart || []).map((c) => c.revenue));
  const labels = { todayVisits: 'Visits today', checkedIn: 'Here now', waitlistOpen: 'Waitlist', unreadMessages: 'Unread messages', privateReviews: 'Reviews to check', noShows30: 'No-shows (30d)', todayRevenue: 'Booked today', revenue30: 'Revenue 30d' };
  return <><div className="grid">{Object.entries(labels).filter(([k]) => s[k] !== undefined).map(([k, l]) => <div key={k} className="card stat"><b>{k.includes('evenue') || k === 'todayRevenue' ? money(s[k]) : s[k]}</b><span>{l}</span></div>)}</div>
    {o.chart && <><h2 style={{ fontSize: 28, margin: '30px 0 14px' }}>Last 7 days</h2><div className="row" style={{ alignItems: 'flex-end', height: 160, flexWrap: 'nowrap' }}>{o.chart.map((c) => <div key={c.date} style={{ flex: 1, textAlign: 'center' }}><div title={money(c.revenue)} style={{ height: Math.max(4, (c.revenue / max) * 120), background: 'var(--brass)', borderRadius: 6 }} /><span className="hint" style={{ fontSize: 12 }}>{dayLabel(c.date).split(' ')[0]}</span></div>)}</div>
      <h2 style={{ fontSize: 28, margin: '30px 0 14px' }}>Popular services</h2>{o.popular.map((p) => <p key={p.name} className="row between"><span>{p.name}</span><span className="hint">{p.bookings} bookings · {money(p.revenue)}</span></p>)}</>}
    <h2 style={{ fontSize: 28, margin: '30px 0 14px' }}>Win-back list <span className="hint" style={{ fontSize: 14 }}>(no visit in 45+ days, nothing booked)</span></h2>
    {w?.map((c) => <p key={c.id} className="row between"><span>{c.name} <span className="hint">· last visit {c.last_visit}</span></span>{c.phone && <a className="btn ghost sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/91${c.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hi ${c.name.split(' ')[0]}, it’s been a while! Your next visit at Verdé is 15% off this month.`)}`}>WhatsApp</a>}</p>)}{w?.length === 0 && <Empty>Everyone has visited recently.</Empty>}</>;
};

const Services = () => {
  const [list, reload] = useGet('/services/all'), [f, set] = useState({ name: '', price: '', duration: 45, category: 'Hair', depositPct: 0 }), act = useAct();
  return <><div className="card"><div className="grid" style={{ gap: 12 }}>{[['name', 'Name'], ['price', 'Price ₹'], ['duration', 'Minutes'], ['category', 'Category'], ['depositPct', 'Deposit %']].map(([k, l]) => <Field key={k} label={l}><input value={f[k]} type={['price', 'duration', 'depositPct'].includes(k) ? 'number' : 'text'} onChange={(e) => set({ ...f, [k]: e.target.value })} /></Field>)}</div>
    <button className="btn sm" style={{ marginTop: 14 }} onClick={async () => { if (await act(() => post('/services', { ...f, price: +f.price, duration: +f.duration, depositPct: +f.depositPct }), 'Service added')) reload(); }}>Add service</button></div>
    <div className="tw" style={{ marginTop: 20 }}><table><tbody>{list?.map((s) => <tr key={s._id}><td>{s.name}<br /><span className="hint">{s.category} · {s.duration} min · deposit {s.depositPct}%</span></td><td>{money(s.price)}</td><td><button className="btn ghost sm" onClick={async () => { await act(() => put(`/services/${s._id}`, { active: !s.active })); reload(); }}>{s.active ? 'Hide' : 'Show'}</button></td></tr>)}</tbody></table></div></>;
};

const Team = () => {
  const [list, reload] = useGet('/staff/all'), [svcs] = useGet('/services'), [f, set] = useState({ name: '', email: '', role: 'Stylist', services: [] }), [created, setCreated] = useState(null), act = useAct();
  return <><div className="card"><div className="grid" style={{ gap: 12 }}>{[['name', 'Name'], ['email', 'Login email'], ['role', 'Role']].map(([k, l]) => <Field key={k} label={l}><input value={f[k]} onChange={(e) => set({ ...f, [k]: e.target.value })} /></Field>)}</div>
    <div className="chips" style={{ margin: '14px 0' }}>{svcs?.map((s) => <button key={s._id} className={`chip${f.services.includes(s._id) ? ' on' : ''}`} onClick={() => set({ ...f, services: f.services.includes(s._id) ? f.services.filter((x) => x !== s._id) : [...f.services, s._id] })}>{s.name}</button>)}</div>
    <button className="btn sm" onClick={async () => { const r = await act(() => post('/staff', { ...f, email: f.email || undefined }), 'Stylist added'); if (r) { setCreated(r); reload(); } }}>Add stylist</button>
    {created?.tempPassword && <div className="note" style={{ marginTop: 14 }}>Temporary password for {created.name}: <b>{created.tempPassword}</b>. Share it once; they should change it after signing in.</div>}</div>
    <div className="tw" style={{ marginTop: 20 }}><table><tbody>{list?.map((m) => <tr key={m._id}><td>{m.name}<br /><span className="hint">{m.role} · {m.services.length} services</span></td><td><span className={`badge ${m.active ? '' : 'cancelled'}`}>{m.active ? 'active' : 'hidden'}</span></td><td><button className="btn ghost sm" onClick={async () => { await act(() => put(`/staff/${m._id}`, { active: !m.active })); reload(); }}>{m.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div></>;
};

const Offers = () => {
  const [list, reload] = useGet('/offers/admin'), [f, set] = useState({ code: '', title: '', discountValue: 10, discountType: 'percent', maxUses: 50, category: '' }), act = useAct();
  return <><div className="card"><div className="grid" style={{ gap: 12 }}>{[['code', 'Code'], ['title', 'Title'], ['discountValue', 'Value'], ['maxUses', 'Max uses'], ['category', 'Only for category (optional)']].map(([k, l]) => <Field key={k} label={l}><input value={f[k]} onChange={(e) => set({ ...f, [k]: e.target.value })} /></Field>)}<Field label="Type"><select value={f.discountType} onChange={(e) => set({ ...f, discountType: e.target.value })}><option value="percent">Percent</option><option value="fixed">Fixed ₹</option></select></Field></div>
    <button className="btn sm" style={{ marginTop: 14 }} onClick={async () => { if (await act(() => post('/offers/admin', { ...f, discountValue: +f.discountValue, maxUses: +f.maxUses, category: f.category || undefined }), 'Offer created')) reload(); }}>Create offer</button></div>
    <div className="tw" style={{ marginTop: 20 }}><table><tbody>{list?.map((o) => <tr key={o.id}><td><b>{o.code}</b><br /><span className="hint">{o.title}{o.user_name && ` · for ${o.user_name}`}</span></td><td>{o.discount_type === 'percent' ? `${o.discount_value}%` : money(o.discount_value)}</td><td>{o.used_count}/{o.max_uses}</td><td><button className="btn ghost sm" onClick={async () => { await act(() => patch(`/offers/admin/${o.id}/active`)); reload(); }}>{o.active ? 'Disable' : 'Enable'}</button></td></tr>)}</tbody></table></div></>;
};

const Reviews = () => {
  const [list, reload] = useGet('/reviews/admin/private'), act = useAct();
  return <><p className="hint" style={{ marginBottom: 16 }}>Reviews of 3 stars or fewer are held here first, so you can reach out before anything is public.</p>{list?.map((r) => <div key={r.id} className="card row between" style={{ marginBottom: 12 }}><div><b>{r.rating} ★</b> · {r.customer} · {r.serviceName} with {r.stylistName}<p>{r.comment}</p></div><div className="row"><button className="btn ghost sm" onClick={async () => { await act(() => patch(`/reviews/admin/${r.id}/publish`), 'Published'); reload(); }}>Publish</button><button className="btn danger sm" onClick={async () => { await act(() => del(`/reviews/admin/${r.id}`)); reload(); }}>Delete</button></div></div>)}{list?.length === 0 && <Empty>Nothing waiting.</Empty>}</>;
};

const Messages = () => {
  const [list, reload] = useGet('/contact'), act = useAct();
  return <>{list?.map((m) => <div key={m._id} className="card row between" style={{ marginBottom: 12, opacity: m.read ? .6 : 1 }}><div><b>{m.name}</b> · <a href={`mailto:${m.email}`} style={{ color: 'var(--brass)' }}>{m.email}</a> {m.phone}<p>{m.message}</p></div><div className="row"><button className="btn ghost sm" onClick={async () => { await act(() => patch(`/contact/${m._id}/read`)); reload(); }}>{m.read ? 'Unread' : 'Read'}</button><button className="btn danger sm" onClick={async () => { await act(() => del(`/contact/${m._id}`)); reload(); }}>Delete</button></div></div>)}{list?.length === 0 && <Empty>No messages.</Empty>}</>;
};

export default function Desk() {
  const { user } = useAuth(), [tab, setTab] = useState('Today');
  const tabs = { Today, Overview, Services, Team, Offers, Reviews, Messages }, View = tabs[tab];
  return <div className="wrap page"><h1 style={{ fontSize: 'clamp(40px,6vw,72px)' }}>Owner Console</h1>
    <div className="tabs" role="tablist" style={{ marginTop: 22 }}>{Object.keys(tabs).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={`chip${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</div><View admin={true} /></div>;
}
