import { useState } from 'react';
import { post, WA } from '../api';
import { Field, useAct } from '../ui';
export default function Contact() {
  const [f, set] = useState({ name: '', email: '', phone: '', message: '' }), act = useAct(), [sent, setSent] = useState(false);
  const on = (k) => (e) => set({ ...f, [k]: e.target.value });
  return <div className="wrap page" style={{ maxWidth: 720 }}><p className="eyebrow">Say hello</p><h1 style={{ fontSize: 'clamp(40px,6vw,72px)' }}>Contact</h1>
    <p className="hint" style={{ margin: '18px 0 26px' }}>Fastest answer: <a href={WA + encodeURIComponent('Hi Verdé, I have a question')} target="_blank" rel="noreferrer" style={{ color: 'var(--brass)' }}>message us on WhatsApp</a>.</p>
    {sent ? <div className="card">Thank you. We will reply soon.</div> : <form className="card" onSubmit={async (e) => { e.preventDefault(); if (await act(() => post('/contact', f))) setSent(true); }}>
      <Field label="Name"><input required minLength={2} autoComplete="name" value={f.name} onChange={on('name')} /></Field><Field label="Email"><input required type="email" inputMode="email" autoComplete="email" value={f.email} onChange={on('email')} /></Field>
      <Field label="Phone (optional)"><input type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={on('phone')} /></Field><Field label="Message"><textarea required minLength={10} rows={5} value={f.message} onChange={on('message')} /></Field>
      <button className="btn" style={{ marginTop: 18 }}>Send message</button></form>}</div>;
}
