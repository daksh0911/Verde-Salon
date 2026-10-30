import { money, post, useGet } from '../api';
import { useAuth } from '../auth';
import { Empty, useAct, useToast } from '../ui';
export default function Rewards() {
  const [l, reloadL] = useGet('/offers/loyalty'), [offers, reloadO] = useGet('/offers/mine'), { user } = useAuth(), act = useAct(), toast = useToast();
  const redeem = async (points) => { if (await act(() => post('/offers/redeem', { points }), 'Reward added to your offers')) { reloadL(); reloadO(); } };
  return <div className="wrap page"><h1 style={{ fontSize: 'clamp(40px,6vw,72px)' }}>Rewards</h1>
    <div className="grid" style={{ margin: '26px 0' }}><div className="card stat"><b>{l?.points ?? '–'}</b><span>points</span></div>
      <div className="card"><p className="eyebrow">Refer a friend</p><p>Share your code <b style={{ color: 'var(--brass)' }}>{user.referralCode}</b>. When they complete their first visit you both get 100 points.</p>
        <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={() => navigator.clipboard?.writeText(user.referralCode).then(() => toast('Code copied'))}>Copy code</button></div>
      <div className="card"><p className="eyebrow">Birthday</p><p className="hint">A treat opens a week before your birthday.</p><button className="btn ghost sm" style={{ marginTop: 12 }} onClick={async () => { if (await act(() => post('/offers/claim-birthday'), 'Birthday offer added')) reloadO(); }}>Claim</button></div></div>
    <h2 style={{ fontSize: 28 }}>Redeem points</h2><div className="grid">{l?.tiers.map((t) => <div key={t.points} className="card"><p className="price">{money(t.off)} off</p><p className="hint">on visits over {money(t.minSpend)}</p><button className="btn sm" style={{ marginTop: 12 }} disabled={l.points < t.points} onClick={() => redeem(t.points)}>{t.points} points</button></div>)}</div>
    <h2 style={{ fontSize: 28, margin: '36px 0 14px' }}>Your offers</h2><div className="grid">{offers?.map((o) => <div key={o.code} className="card"><h3>{o.title}</h3><p className="hint">{o.description}</p><p className="eyebrow" style={{ marginTop: 10 }}>{o.code}{o.expires_at && ` · until ${o.expires_at}`}</p></div>)}{offers?.length === 0 && <Empty>No active offers right now.</Empty>}</div>
    <h2 style={{ fontSize: 28, margin: '36px 0 14px' }}>Points history</h2>{l?.history.length ? <div className="tw"><table><tbody>{l.history.map((h, i) => <tr key={i}><td>{h.created_at.slice(0, 10)}</td><td>{h.reason}</td><td style={{ textAlign: 'right' }}>{h.points > 0 ? '+' : ''}{h.points}</td></tr>)}</tbody></table></div> : <Empty>Points are added once a visit is completed.</Empty>}</div>;
}
