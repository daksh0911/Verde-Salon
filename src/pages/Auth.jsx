import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { post } from '../api';
import { home, useAuth } from '../auth';
import { Link } from 'react-router-dom';
import { Field, useAct } from '../ui';
export default function Auth() {
  const [mode, setMode] = useState('login'), [f, set] = useState({ name: '', email: '', phone: '', password: '', birthday: '', referralCode: '' }), [agree, setAgree] = useState(false), { setUser } = useAuth(), nav = useNavigate(), loc = useLocation(), act = useAct();
  const on = (k) => (e) => set({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const body = mode === 'login' ? { email: f.email, password: f.password } : { ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), consent: agree };
    const u = await act(() => post(`/auth/${mode === 'login' ? 'login' : 'register'}`, body)); if (!u) return;
    setUser(u); nav(loc.state?.from && u.role === 'customer' ? loc.state.from : home(u), { replace: true });
  };
  return <div className="wrap page" style={{ maxWidth: 480 }}><h1 style={{ fontSize: 56 }}>{mode === 'login' ? 'Welcome back' : 'Join Verdé'}</h1>
    <form className="card" style={{ marginTop: 24 }} onSubmit={submit}>
      {mode === 'register' && <Field label="Full name"><input required minLength={2} autoComplete="name" value={f.name} onChange={on('name')} /></Field>}
      <Field label="Email"><input required type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={f.email} onChange={on('email')} /></Field>
      {mode === 'register' && <><Field label="Phone"><input type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={on('phone')} placeholder="+91…" /></Field><Field label="Birthday (for a yearly treat)"><input type="date" value={f.birthday} onChange={on('birthday')} /></Field><Field label="Referral code (optional)"><input autoCapitalize="characters" autoComplete="off" value={f.referralCode} onChange={on('referralCode')} /></Field></>}
      <Field label="Password"><input required type="password" minLength={mode === 'login' ? 1 : 8} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={on('password')} /></Field>
      {mode === 'register' && <p className="hint" style={{ marginTop: 8 }}>8+ characters with at least one letter and one number.</p>}
      {mode === 'register' && <label className="row" style={{ gap: 10, marginTop: 14, alignItems: 'flex-start', flexWrap: 'nowrap' }}><input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 'auto', marginTop: 4 }} /><span className="hint">I have read the <Link to="/privacy" target="_blank">Privacy Policy</Link> and agree to {'Verdé'} storing my details to run my bookings.</span></label>}
      <button className="btn" style={{ width: '100%', marginTop: 20 }}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
    </form>
    <p className="hint" style={{ marginTop: 18, textAlign: 'center' }}>{mode === 'login' ? 'New here?' : 'Already a client?'} <button className="chip" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    <p className="hint" style={{ marginTop: 10, textAlign: 'center' }}>Stylist or front-desk? Use your sign-in above. Accounts are created by the owner.</p></div>;
}
