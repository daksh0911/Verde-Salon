import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CONSENT_KEY } from './legal';
const seen = () => { try { return !!localStorage.getItem(CONSENT_KEY); } catch { return true; } };
// We only set one essential sign-in cookie, so this is a notice with a clear way to learn more rather than a tracking opt-in.
export default function CookieBanner() {
  const [hide, setHide] = useState(seen());
  if (hide) return null;
  const ok = () => { try { localStorage.setItem(CONSENT_KEY, new Date().toISOString().slice(0, 10)); } catch { /* ignore */ } setHide(true); };
  return <div className="cookie" role="region" aria-label="Cookie notice">
    <p>We use one essential cookie to keep you signed in. No ads, no tracking. <Link to="/cookies">Cookie Policy</Link> · <Link to="/privacy">Privacy Policy</Link></p>
    <button className="btn sm" onClick={ok}>Got it</button>
  </div>;
}
