import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGet, money } from '../api';
import { Photo, serviceImage } from '../ui';

export default function Services() {
  const [svcs] = useGet('/services');
  const [activeGender, setActiveGender] = useState('all'); // 'all', 'women', 'men'
  const [cat, setCat] = useState('All');

  const visibleSvcs = (svcs || []).filter((s) => {
    const matchGender = activeGender === 'all' || s.gender === activeGender || s.gender === 'unisex';
    const matchCat = cat === 'All' || s.category === cat;
    return matchGender && matchCat;
  });

  const cats = ['All', ...new Set((svcs || []).map((s) => s.category))];

  const womenSvcs = visibleSvcs.filter((s) => s.gender === 'women');
  const menSvcs = visibleSvcs.filter((s) => s.gender === 'men');
  const unisexSvcs = visibleSvcs.filter((s) => s.gender === 'unisex' || !s.gender);

  return (
    <div className="wrap page">
      <p className="eyebrow">The unisex sanctuary</p>
      <h1 style={{ fontSize: 'clamp(40px,6vw,72px)' }}>Services Menu</h1>
      <p className="hint" style={{ marginTop: 8, maxWidth: 640 }}>
        Tailored luxury grooming and styling rituals meticulously designed for both men and women.
      </p>

      {/* Modern Filter Toolbar */}
      <div className="filter-toolbar">
        {/* Gender Segmented Switcher */}
        <div className="segmented-control" role="tablist" aria-label="Audience filter">
          <button
            className={`seg-btn ${activeGender === 'all' ? 'active' : ''}`}
            onClick={() => setActiveGender('all')}
          >
            All Offerings
          </button>
          <button
            className={`seg-btn ${activeGender === 'women' ? 'active' : ''}`}
            onClick={() => setActiveGender('women')}
          >
            Women (6)
          </button>
          <button
            className={`seg-btn ${activeGender === 'men' ? 'active' : ''}`}
            onClick={() => setActiveGender('men')}
          >
            Men (6)
          </button>
        </div>

        {/* Category Filter Pills */}
        <div className="category-scroll" role="tablist" aria-label="Category filter">
          {cats.map((c) => (
            <button
              key={c}
              className={`cat-pill ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Render sections depending on active filter */}
      {activeGender === 'all' ? (
        <>
          {womenSvcs.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2>Women’s Collection</h2>
                <span className="hint">{womenSvcs.length} services</span>
              </div>
              <div className="grid">
                {womenSvcs.map((s) => (
                  <article key={s._id} className="card">
                    <Photo src={serviceImage(s)} alt={s.name} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <p className="eyebrow" style={{ margin: 0 }}>{s.category}</p>
                      <span className="chip" style={{ fontSize: 11, padding: '2px 8px' }}>Women</span>
                    </div>
                    <h3 style={{ marginTop: 8 }}>{s.name}</h3>
                    <p className="hint">{s.description}</p>
                    <div className="meta">
                      <span className="hint">{s.duration} min{s.depositPct ? ` · ${s.depositPct}% deposit` : ''}</span>
                      <span className="price">{money(s.price)}</span>
                    </div>
                    <Link className="btn sm" style={{ marginTop: 14 }} to={`/book?service=${s._id}`}>
                      Book Appointment
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {menSvcs.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2>Men’s Collection</h2>
                <span className="hint">{menSvcs.length} services</span>
              </div>
              <div className="grid">
                {menSvcs.map((s) => (
                  <article key={s._id} className="card">
                    <Photo src={serviceImage(s)} alt={s.name} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <p className="eyebrow" style={{ margin: 0 }}>{s.category}</p>
                      <span className="chip" style={{ fontSize: 11, padding: '2px 8px' }}>Men</span>
                    </div>
                    <h3 style={{ marginTop: 8 }}>{s.name}</h3>
                    <p className="hint">{s.description}</p>
                    <div className="meta">
                      <span className="hint">{s.duration} min{s.depositPct ? ` · ${s.depositPct}% deposit` : ''}</span>
                      <span className="price">{money(s.price)}</span>
                    </div>
                    <Link className="btn sm" style={{ marginTop: 14 }} to={`/book?service=${s._id}`}>
                      Book Appointment
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {unisexSvcs.length > 0 && (
            <section style={{ marginBottom: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <h2>Unisex Rituals</h2>
                <span className="hint">{unisexSvcs.length} services</span>
              </div>
              <div className="grid">
                {unisexSvcs.map((s) => (
                  <article key={s._id} className="card">
                    <Photo src={serviceImage(s)} alt={s.name} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <p className="eyebrow" style={{ margin: 0 }}>{s.category}</p>
                      <span className="chip" style={{ fontSize: 11, padding: '2px 8px' }}>Unisex</span>
                    </div>
                    <h3 style={{ marginTop: 8 }}>{s.name}</h3>
                    <p className="hint">{s.description}</p>
                    <div className="meta">
                      <span className="hint">{s.duration} min{s.depositPct ? ` · ${s.depositPct}% deposit` : ''}</span>
                      <span className="price">{money(s.price)}</span>
                    </div>
                    <Link className="btn sm" style={{ marginTop: 14 }} to={`/book?service=${s._id}`}>
                      Book Appointment
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="grid">
          {visibleSvcs.map((s) => (
            <article key={s._id} className="card">
              <Photo src={serviceImage(s)} alt={s.name} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <p className="eyebrow" style={{ margin: 0 }}>{s.category}</p>
                <span className="chip" style={{ fontSize: 11, padding: '2px 8px', textTransform: 'capitalize' }}>
                  {s.gender}
                </span>
              </div>
              <h3 style={{ marginTop: 8 }}>{s.name}</h3>
              <p className="hint">{s.description}</p>
              <div className="meta">
                <span className="hint">{s.duration} min{s.depositPct ? ` · ${s.depositPct}% deposit` : ''}</span>
                <span className="price">{money(s.price)}</span>
              </div>
              <Link className="btn sm" style={{ marginTop: 14 }} to={`/book?service=${s._id}`}>
                Book Appointment
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
