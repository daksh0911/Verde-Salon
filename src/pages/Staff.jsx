import { useState } from 'react';
import { clock, dayLabel, del, get, patch, post, put, useGet, ymd } from '../api';
import { Empty, Field, useAct } from '../ui';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Visit({ v, reload }) {
  const act = useAct(), [notes, setNotes] = useState(null), [txt, setTxt] = useState('');
  const c = v.consult, set = async (status) => { if (await act(() => patch(`/appointments/${v._id}/status`, { status }), `Marked ${status}`)) reload(); };
  const open = async () => setNotes(notes ? null : await get(`/staff-portal/clients/${v.customer._id}/notes`).catch(() => []));
  return <article className="card stack"><div className="row between"><div><h3>{clock(v.start)} · {v.services.map((s) => s.name).join(' + ')}</h3><p className="hint">{v.customer.name} · {v.customer.phone || 'no phone'}</p></div><div className="row">{v.checkedIn && v.status === 'booked' && <span className="badge in">Here now</span>}{v.patch === 'needed' && v.status === 'booked' && <span className="badge warn">Patch test needed</span>}<span className={`badge ${v.status}`}>{v.status}</span></div></div>
    {c && <div className="note"><b>Consultation card</b><br />{['hairType', 'allergies', 'goal', 'notes'].filter((k) => c[k]).map((k) => <span key={k}>{k.replace(/([A-Z])/g, ' $1')}: {c[k]}<br /></span>)}{/^https:\/\//i.test(c.inspoUrl || '') && <a href={c.inspoUrl} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--brass)' }}>Inspiration photo ↗</a>}</div>}
    <div className="row">{v.status === 'booked' && <>{v.patch === 'needed' && <button className="btn ghost sm" onClick={async () => { if (await act(() => patch(`/appointments/${v._id}/patch-test`), 'Patch test recorded')) reload(); }}>Patch test done</button>}<button className="btn sm" onClick={() => set('completed')}>Complete</button><button className="btn danger sm" onClick={() => set('no-show')}>No-show</button></>}<button className="btn ghost sm" onClick={open}>Client notes</button></div>
    {notes && <div className="note">{notes.map((n) => <p key={n.id}>{n.created_at.slice(0, 10)} · {n.author}: {n.note}</p>)}{!notes.length && <p>No notes yet.</p>}
      <div className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }}><input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Colour formula, preferences…" /><button className="btn sm" disabled={txt.length < 2} onClick={async () => { await act(() => post(`/staff-portal/clients/${v.customer._id}/notes`, { note: txt })); setTxt(''); setNotes(await get(`/staff-portal/clients/${v.customer._id}/notes`)); }}>Add</button></div></div>}</article>;
}

export default function Staff() {
  const [d, reload] = useGet('/staff-portal/dashboard'), act = useAct(), [off, setOff] = useState({ date: ymd(new Date()), reason: '' }), [list, reloadOff] = useGet(d && `/staff/${d.staff._id}/time-off`);
  if (!d) return <p className="wrap page hint">Loading…</p>;
  const s = d.staff, save = async (body) => { if (await act(() => put('/staff-portal/schedule', body), 'Schedule saved')) reload(); };
  return <div className="wrap page"><p className="eyebrow">{dayLabel(ymd(new Date()))}</p><h1 style={{ fontSize: 'clamp(40px,6vw,72px)' }}>Hello, {s.name.split(' ')[0]}</h1>
    <div className="grid" style={{ margin: '24px 0' }}>{[['Today', d.stats.today], ['Here now', d.stats.checkedIn], ['Upcoming', d.stats.upcoming]].map(([k, n]) => <div key={k} className="card stat"><b>{n}</b><span>{k}</span></div>)}</div>
    <h2 style={{ fontSize: 28 }}>Today</h2><div className="stack">{d.today.map((v) => <Visit key={v._id} v={v} reload={reload} />)}{!d.today.length && <Empty>No visits today.</Empty>}</div>
    <h2 style={{ fontSize: 28, margin: '40px 0 14px' }}>My hours</h2><div className="card"><div className="chips">{DAYS.map((n, i) => <button key={n} className={`chip${s.days[i] ? ' on' : ''}`} onClick={() => save({ days: s.days.map((x, j) => (j === i ? !x : x)) })}>{n}</button>)}</div>
      <div className="row" style={{ marginTop: 14 }}>{['from', 'to'].map((k) => <Field key={k} label={k}><select value={s[k]} onChange={(e) => save({ [k]: Number(e.target.value) })}>{[...Array(25).keys()].map((h) => <option key={h} value={h}>{clock(h * 60)}</option>)}</select></Field>)}</div></div>
    <h2 style={{ fontSize: 28, margin: '36px 0 14px' }}>Time off</h2><div className="card"><div className="row"><input type="date" style={{ maxWidth: 200 }} min={ymd(new Date())} value={off.date} onChange={(e) => setOff({ ...off, date: e.target.value })} /><input style={{ maxWidth: 240 }} placeholder="Reason (optional)" value={off.reason} onChange={(e) => setOff({ ...off, reason: e.target.value })} /><button className="btn sm" onClick={async () => { if (await act(() => post(`/staff/${s._id}/time-off`, { date: off.date, reason: off.reason || undefined }), 'Day blocked')) reloadOff(); }}>Block whole day</button></div>
      {list?.map((t) => <p key={t.id} className="hint" style={{ marginTop: 10 }}>{dayLabel(t.date)} {t.reason && `· ${t.reason}`} <button className="btn ghost sm" onClick={async () => { await act(() => del(`/staff/${s._id}/time-off/${t.id}`)); reloadOff(); }}>Remove</button></p>)}</div></div>;
}
