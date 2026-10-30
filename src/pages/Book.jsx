import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { clock, dayLabel, get, money, next14, post, useGet } from '../api';
import { Empty, Field, useAct } from '../ui';
export default function Book() {
  const [q] = useSearchParams(), nav = useNavigate(), act = useAct();
  const [svcs] = useGet('/services'), [staff] = useGet('/staff'), [mine] = useGet('/offers/mine'), days = useMemo(next14, []);
  const [ids, setIds] = useState(q.get('service') ? [Number(q.get('service'))] : []), [who, setWho] = useState(q.get('stylist') ? Number(q.get('stylist')) : 'any');
  const [date, setDate] = useState(days[0]), [slots, setSlots] = useState(null), [pick, setPick] = useState(null);
  const [cs, setCs] = useState({ hairType: '', goal: '', allergies: '', inspoUrl: '', notes: '' }), [code, setCode] = useState(''), [applied, setApplied] = useState(null), [done, setDone] = useState(null);
  const chosen = svcs?.filter((s) => ids.includes(s._id)) || [], total = chosen.reduce((a, s) => a + s.price, 0), mins = chosen.reduce((a, s) => a + s.duration, 0);
  const able = staff?.filter((m) => ids.every((i) => m.services.includes(i))) || [];
  const final = total - (applied?.discount || 0), deposit = Math.round(chosen.reduce((a, s) => a + s.price * s.depositPct / 100, 0) * (total ? final / total : 1));

  useEffect(() => { if (who !== 'any' && !able.some((m) => m._id === who) && ids.length) setWho('any'); }, [ids]); // eslint-disable-line
  useEffect(() => {
    setPick(null); setApplied(null);
    if (!ids.length) return setSlots(null);
    const qs = `serviceIds=${ids}&date=${date}`; let live = true; setSlots(undefined);
    get(who === 'any' ? `/availability/any?${qs}` : `/availability?staffId=${who}&${qs}`).then((s) => live && setSlots(s.map((x) => ({ ...x, available: x.available ?? true })))).catch(() => live && setSlots([]));
    return () => { live = false; };
  }, [ids, who, date]);

  const toggle = (id) => setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, 5));
  const free = slots?.filter((s) => s.available) || [];
  const apply = (c) => act(async () => { const r = await post('/offers/validate', { code: c, serviceIds: ids }); setApplied(r); setCode(r.code); }, 'Offer applied');
  const confirm = () => act(async () => {
    const body = { serviceIds: ids, staffId: pick.staffId ?? who, date, start: pick.start, offerCode: applied?.code, consult: Object.fromEntries(Object.entries(cs).filter(([, v]) => v)) };
    setDone(await post('/appointments', body));
  });
  const wait = () => act(() => post('/waitlist', { serviceId: ids[0], staffId: who === 'any' ? undefined : who, date }), 'You are on the waitlist. We will offer you the first free time.');

  if (done) return <div className="wrap page" style={{ maxWidth: 640 }}><h1 style={{ fontSize: 56 }}>You’re booked.</h1><div className="card stack" style={{ marginTop: 22 }}>
    <p><b>{done.services.map((s) => s.name).join(' + ')}</b><br />{dayLabel(done.date)} at {clock(done.start)} with {done.staff.name}</p>
    <p className="price">{money(done.final_amount)}</p>
    {done.deposit && <div className="note">A deposit of <b>{money(done.deposit.amount)}</b> is due to hold this booking. Pay at the front desk or by UPI on WhatsApp; free cancellation up to 4 hours before.</div>}
    <div className="row"><Link className="btn" to="/visits">View my visits</Link><button className="btn ghost" onClick={() => nav(0)}>Book another</button></div></div></div>;

  return <div className="wrap page"><h1 style={{ fontSize: 'clamp(40px,6vw,72px)' }}>Book a visit</h1>
    <h2 style={{ fontSize: 28, margin: '30px 0 14px' }}>1 · Choose services <span className="hint" style={{ fontSize: 14 }}>(up to 5)</span></h2>
    <div className="grid">{svcs?.map((s) => <button key={s._id} className={`card pick${ids.includes(s._id) ? ' on' : ''}`} style={{ textAlign: 'left', color: 'inherit', font: 'inherit' }} aria-pressed={ids.includes(s._id)} onClick={() => toggle(s._id)}>
      <h3>{s.name}</h3><p className="hint">{s.duration} min · {s.category}</p><div className="meta"><span className="hint">{s.depositPct ? `${s.depositPct}% deposit` : ''}</span><span className="price">{money(s.price)}</span></div></button>)}</div>

    {ids.length > 0 && <><h2 style={{ fontSize: 28, margin: '36px 0 14px' }}>2 · Stylist and time</h2>
      {chosen.some((s) => s.category === 'Colour') && <p className="note" style={{ margin: '0 0 16px' }}>Colour needs a quick allergy patch test at least 48 hours before your visit. It is free and takes about 10 minutes; ask us when you drop by or message us on WhatsApp.</p>}
      {able.length === 0 ? <Empty>No single stylist offers all of these. Try fewer services.</Empty> : <>
        <div className="chips"><button className={`chip${who === 'any' ? ' on' : ''}`} onClick={() => setWho('any')}>Any available stylist</button>{able.map((m) => <button key={m._id} className={`chip${who === m._id ? ' on' : ''}`} onClick={() => setWho(m._id)}>{m.name}</button>)}</div>
        <div className="chips days" style={{ margin: "18px 0" }}>{days.map((d) => <button key={d} className={`chip${date === d ? ' on' : ''}`} onClick={() => setDate(d)}>{dayLabel(d)}</button>)}</div>
        {slots === undefined ? <Empty>Checking the calendar…</Empty> : free.length ? <div className="chips" role="group" aria-label="Available times">{free.map((s) => <button key={s.start + '-' + (s.staffId || '')} className={`chip${pick?.start === s.start ? ' on' : ''}`} onClick={() => setPick(s)}>{clock(s.start)}{s.staffName && <small className="hint"> · {s.staffName.split(' ')[0]}</small>}</button>)}</div>
          : <div className="note">Fully booked that day. <button className="btn sm" onClick={wait}>Join the waitlist</button> and we will offer you the first free time, or pick another day.</div>}</>}</>}

    {pick && <><h2 style={{ fontSize: 28, margin: '36px 0 14px' }}>3 · Tell your stylist <span className="hint" style={{ fontSize: 14 }}>(optional)</span></h2>
      <div className="card"><div className="grid" style={{ gap: 0 }}><Field label="Hair type"><input value={cs.hairType} onChange={(e) => setCs({ ...cs, hairType: e.target.value })} placeholder="Fine, wavy, colour-treated…" /></Field><Field label="Allergies / sensitivities"><input value={cs.allergies} onChange={(e) => setCs({ ...cs, allergies: e.target.value })} /></Field></div>
        <Field label="What would you love?"><textarea rows={2} value={cs.goal} onChange={(e) => setCs({ ...cs, goal: e.target.value })} /></Field><Field label="Inspiration photo link"><input type="url" value={cs.inspoUrl} onChange={(e) => setCs({ ...cs, inspoUrl: e.target.value })} placeholder="https://…" /></Field></div>
      <h2 style={{ fontSize: 28, margin: '30px 0 14px' }}>4 · Offer</h2><div className="row">{mine?.map((o) => <button key={o.code} className={`chip${applied?.code === o.code ? ' on' : ''}`} onClick={() => apply(o.code)}>{o.title}</button>)}
        <input style={{ maxWidth: 220 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Have a code?" /><button className="btn ghost sm" disabled={!code} onClick={() => apply(code)}>Apply</button></div></>}

    {pick && <div className="sticky"><div><b>{chosen.map((s) => s.name).join(' + ')}</b><br /><span className="hint">{dayLabel(date)} · {clock(pick.start)} · {mins} min{deposit ? ` · deposit ${money(deposit)}` : ''}</span></div>
      <div className="row"><span className="price">{applied && <s className="hint" style={{ fontSize: 16 }}>{money(total)} </s>}{money(final)}</span><button className="btn" onClick={confirm}>Confirm booking</button></div></div>}</div>;
}
