import { Link } from 'react-router-dom';
import { useGet } from '../api';
import { Photo, Stars } from '../ui';
export default function Team() {
  const [team] = useGet('/staff');
  return <div className="wrap page"><p className="eyebrow">The people</p><h1 style={{ fontSize: 'clamp(40px,6vw,72px)' }}>Our team</h1>
    <div className="grid" style={{ marginTop: 30 }}>{team?.map((m) => <article key={m._id} className="card"><Photo src={m.avatar} alt={m.name} /><h3>{m.name}</h3><p className="hint">{m.role} · {m.experience} yrs</p><p style={{ margin: '10px 0' }}>{m.bio}</p>
      {m.rating ? <p><Stars n={m.rating} /> <span className="hint">{m.rating} from {m.reviewCount} reviews</span></p> : <p className="hint">New reviews coming soon</p>}
      <Link className="btn sm" style={{ marginTop: 12 }} to={`/book?stylist=${m._id}`}>Book with {m.name.split(' ')[0]}</Link></article>)}</div></div>;
}
