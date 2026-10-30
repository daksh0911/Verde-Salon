import { useState } from 'react';
import { Link } from 'react-router-dom';
import { money, useGet } from '../api';
import { Photo } from '../ui';

const GOAL = [['A fresh cut', 'Shape and style', ['Hair']], ['New colour', 'Highlights and gloss', ['Colour']], ['Glow', 'Facial and skin care', ['Skin']], ['A big day', 'Wedding or event', ['Bridal', 'Makeup']], ['Relax and repair', 'Hair spa and care', ['Spa']], ['Nails', 'Manicure and finish', ['Nails']]];
const TIME = [['Quick', 'Under an hour', 60], ['Unhurried', 'I have time', 1e9]];
const BUDGET = [['Up to ₹1,500', 'Keep it light', 1500], ['Up to ₹5,000', 'A proper treat', 5000], ['No limit', 'Show me the best', 1e9]];
const STEPS = [['What are you in the mood for?', GOAL], ['How much time do you have?', TIME], ['What feels right for the budget?', BUDGET]];
const keep = (arr, fn) => { const r = arr.filter(fn); return r.length ? r : arr; }; // never filter down to nothing

export default function Match() {
  const [svcs] = useGet('/services'), [team] = useGet('/staff'), [pick, setPick] = useState([]);
  const step = pick.length, done = step === STEPS.length;
  let svc, who;
  if (done && svcs && team) {
    let pool = svcs.filter((s) => pick[0][2].includes(s.category)); if (!pool.length) pool = svcs;
    pool = keep(keep(pool, (s) => s.duration <= pick[1][2]), (s) => s.price <= pick[2][2]);
    svc = [...pool].sort((a, b) => b.price - a.price)[0];
    who = svc && team.filter((m) => m.services.includes(svc._id)).sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
  }
  return <div className="wrap page" style={{ maxWidth: 760 }}>
    <p className="eyebrow">Not sure what to book?</p><h1 style={{ fontSize: 'clamp(40px,6vw,72px)' }}>Find my look</h1>
    <div className="dots" aria-hidden="true">{STEPS.map((_, i) => <span key={i} className={i < step ? 'on' : i === step ? 'now' : ''} />)}</div>
    {!done && <div key={step} className="step-in"><h2 style={{ fontSize: 30, margin: '10px 0 18px' }}>{STEPS[step][0]}</h2>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))' }}>{STEPS[step][1].map((o) => <button key={o[0]} className="opt" onClick={() => setPick([...pick, o])}><b>{o[0]}</b><span className="hint">{o[1]}</span></button>)}</div>
      {step > 0 && <button className="chip" style={{ marginTop: 18 }} onClick={() => setPick(pick.slice(0, -1))}>← Back</button>}</div>}
    {done && <div className="step-in">{svc ? <article className="card result">
      <p className="eyebrow">Our suggestion</p><Photo src={svc.image} alt={svc.name} /><h2 style={{ fontSize: 38, margin: '4px 0 6px' }}>{svc.name}</h2><p className="hint">{svc.description}</p>
      <div className="meta"><span className="hint">{svc.duration} min{who ? ` · with ${who.name}` : ''}</span><span className="price">{money(svc.price)}</span></div>
      {svc.category === 'Colour' && <p className="note" style={{ marginTop: 14 }}>Colour needs a quick patch test at least 48 hours before. We will remind you when you book.</p>}
      <div className="row" style={{ marginTop: 18 }}><Link className="btn" to={`/book?service=${svc._id}${who ? `&stylist=${who._id}` : ''}`}>Book this</Link><button className="btn ghost" onClick={() => setPick([])}>Start over</button><Link className="btn ghost" to="/services">See all services</Link></div>
    </article> : <p className="hint">Loading…</p>}</div>}
  </div>;
}
