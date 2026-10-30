import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, home } from './auth';
import { useT } from './i18n';
import CookieBanner from './CookieBanner';
import { useReveal, useScrolled } from './motion';
const NAV = [['/services', 'services'], ['/match', 'match'], ['/team', 'team'], ['/contact', 'contact']];
export function Layout() {
  const { user, logout } = useAuth(), { t } = useT(), [open, setOpen] = useState(false);
  const { pathname } = useLocation(), scrolled = useScrolled(); useReveal(pathname); // drawer closes on navigation
  const mine = user && [[home(user), { customer: 'visits', staff: 'portal' }[user.role] || 'desk'], ...(user.role === 'customer' ? [['/rewards', 'rewards']] : [])];
  return <>
    <header className={`top${open ? ' open' : ''}${scrolled ? ' scrolled' : ''}`} onClick={() => open && setOpen(false)}><div className="wrap">
      <Link to="/" className="brand">Verdé</Link>
      <button className="btn ghost sm burger" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? 'Close' : 'Menu'}</button>
      <nav aria-label="Main">{[...NAV, ...(mine || [])].map(([to, k]) => <NavLink key={to} to={to}>{t(k)}</NavLink>)}</nav>
      <div className="acts">
        {user ? <button className="btn ghost sm" onClick={logout}>{t('out')}</button> : <Link className="btn ghost sm" to="/login">{t('login')}</Link>}
        {(!user || user.role === 'customer') && <Link className="btn sm" to="/book">{t('book')}</Link>}
      </div>
    </div></header>
    <main key={pathname} className="page-in"><Outlet /></main>
    <footer><div className="wrap"><div><Link to="/" className="brand">Verdé</Link><p>Hair · Colour · Skin · Bridal — Ahmedabad</p></div><p>Mon–Sat, 10am–7pm<br />Closed Sundays</p><p><Link to="/privacy">Privacy Policy</Link><br /><Link to="/cookies">Cookie Policy</Link></p></div></footer>
    <CookieBanner />
  </>;
}
