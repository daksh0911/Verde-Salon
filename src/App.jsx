import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './layout';
import { useAuth } from './auth';
import Home from './pages/Home';
const L = (f) => lazy(f);
const Services = L(() => import('./pages/Services')), Team = L(() => import('./pages/Team')), Contact = L(() => import('./pages/Contact')), Auth = L(() => import('./pages/Auth')), Match = L(() => import('./pages/Match'));
const Privacy = L(() => import('./pages/Legal').then((m) => ({ default: m.Privacy }))), Cookies = L(() => import('./pages/Legal').then((m) => ({ default: m.Cookies })));
const Book = L(() => import('./pages/Book')), Visits = L(() => import('./pages/Visits')), Rewards = L(() => import('./pages/Rewards'));
const Staff = L(() => import('./pages/Staff')), Desk = L(() => import('./pages/Desk'));

function Need({ roles, children }) {
  const { user } = useAuth(), loc = useLocation();
  if (user === undefined) return <p className="wrap page hint">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return roles.includes(user.role) ? children : <Navigate to="/" replace />;
}
import ErrorBoundary from './ErrorBoundary';

export default function App() {
  return <Suspense fallback={<div className="wrap page"><div className="skel" /></div>}><Routes><Route element={<Layout />}>
    <Route path="/" element={<Home />} /><Route path="/services" element={<Services />} /><Route path="/team" element={<Team />} /><Route path="/contact" element={<Contact />} /><Route path="/login" element={<Auth />} /><Route path="/match" element={<Match />} /><Route path="/privacy" element={<Privacy />} /><Route path="/cookies" element={<Cookies />} />
    <Route path="/book" element={<Need roles={['customer']}><Book /></Need>} />
    <Route path="/visits" element={<Need roles={['customer']}><Visits /></Need>} />
    <Route path="/rewards" element={<Need roles={['customer']}><Rewards /></Need>} />
    <Route path="/staff" element={<Need roles={['staff']}><Staff /></Need>} />
    <Route path="/desk" element={<Need roles={['admin']}><Desk /></Need>} />
    <Route path="*" element={<p className="wrap page hint">Page not found.</p>} />
  </Route></Routes></Suspense>;
}
