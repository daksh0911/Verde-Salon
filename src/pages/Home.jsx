import { Link } from 'react-router-dom';
import { useGet, money } from '../api';
import { useT } from '../i18n';
import { Photo, serviceImage, Stars } from '../ui';
import { BeforeAfter } from '../motion';
const heroImage = `${import.meta.env.BASE_URL}hero.jpg`;
export default function Home() {
  const { t } = useT(), [svcs] = useGet('/services'), [team] = useGet('/staff'), [live] = useGet('/availability/live'), [reviews] = useGet('/reviews?limit=3'), [gal] = useGet('/gallery');
  return <>
    <section className="wrap hero"><div>
      {live && <div className="live rise"><span className={`dot${live.openNow ? ' on' : ''}`} />{live.openNow ? t('open') : t('closed')}{live.nextFree && <> · {t('nextFree')}: <b>{live.nextFree.time}</b></>}</div>}
      <h1 className="rise" style={{ '--d': '.1s' }}>{t('hero1')}<br />{t('hero2')}</h1><p className="lead rise" style={{ '--d': '.25s' }}>{t('sub')}</p>
      <div className="row rise" style={{ '--d': '.4s' }}><Link className="btn" to="/book">{t('book')}</Link><Link className="btn ghost" to="/services">{t('menu')}</Link><Link className="btn ghost" to="/match">{t('match')}</Link></div>
    </div><div className="arch"><img src={heroImage} alt="Warmly lit salon interior" fetchpriority="high" /></div></section>
    <section className="band alt"><div className="wrap"><h2>{t('services')}</h2><div className="grid">
      {svcs?.slice(0, 3).map((s) => <Link key={s._id} to="/services" className="card" style={{ textDecoration: 'none' }}><Photo src={serviceImage(s)} alt={s.name} /><h3>{s.name}</h3><p className="hint">{s.description}</p><div className="meta"><span className="hint">{s.duration} min</span><span className="price">{money(s.price)}</span></div></Link>)}
    </div></div></section>
    {gal?.length > 0 && <section className="band"><div className="wrap"><h2>See the difference</h2><p className="hint" style={{ marginBottom: 22 }}>Drag the slider. Shared with each client's consent.</p><div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>{gal.map((g) => <BeforeAfter key={g.id} before={g.before_image} after={g.after_image} title={g.title} by={g.stylist_name} />)}</div></div></section>}
    <section className="band alt"><div className="wrap"><h2>{t('people')}</h2><div className="grid">
      {team?.map((m) => <div key={m._id} className="card row" style={{ flexWrap: 'nowrap' }}><Photo className="round" src={m.avatar} alt={m.name} /><div><h3>{m.name}</h3><p className="hint">{m.role}</p>{m.rating && <p><Stars n={m.rating} /> <span className="hint">{m.rating} ({m.reviewCount})</span></p>}</div></div>)}
    </div></div></section>
    {reviews?.length > 0 && <section className="band alt"><div className="wrap"><h2>{t('kind')}</h2><div className="grid">
      {reviews.map((r) => <figure key={r.id} className="card" style={{ margin: 0 }}><Stars n={r.rating} /><p className="quote">“{r.comment}”</p><figcaption className="hint">{r.customer} · {r.serviceName}</figcaption></figure>)}
    </div></div></section>}
  </>;
}
