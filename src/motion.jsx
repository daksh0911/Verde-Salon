import { useEffect, useState } from 'react';

// Pages where content gently fades up as it scrolls into view. Working screens (desk, staff, visits) stay still.
const PUBLIC = ['/', '/services', '/team', '/contact', '/match', '/privacy', '/cookies'];
const SEL = 'main .card, main h2, main .ba, main .opt, main .hint-block';
export function useReveal(pathname) {
  useEffect(() => {
    if (!PUBLIC.includes(pathname) || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver((entries) => {
      let i = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target; io.unobserve(el);
        el.style.setProperty('--rd', `${Math.min(i++, 6) * 80}ms`); el.classList.add('rv-in');
        setTimeout(() => { el.classList.remove('rv', 'rv-in'); el.style.removeProperty('--rd'); }, 1100); // done: hover effects work normally again
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    const scan = (root) => root.querySelectorAll?.(SEL).forEach((el) => { if (el.closest('.hero') || el.dataset.seen) return; el.dataset.seen = '1'; el.classList.add('rv'); io.observe(el); });
    const main = document.querySelector('main'); if (!main) return;
    scan(document);
    const mo = new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches?.(SEL) ? scan({ querySelectorAll: () => [n] }) : scan(n)))));
    mo.observe(main, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [pathname]);
}
export function useScrolled() {
  const [s, set] = useState(false);
  useEffect(() => { const f = () => set(scrollY > 12); f(); addEventListener('scroll', f, { passive: true }); return () => removeEventListener('scroll', f); }, []);
  return s;
}

// Drag to compare. A transparent range input sits on top, so mouse, touch and keyboard all work.
const resolveImg = (src) => {
  if (!src) return `${import.meta.env.BASE_URL}hero.jpg`;
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src;
  const clean = src.startsWith('/') ? src.slice(1) : src;
  return `${import.meta.env.BASE_URL}${clean}`;
};

export function BeforeAfter({ before, after, title, by }) {
  const [p, setP] = useState(55);
  return <figure className="ba" style={{ margin: 0 }}>
    <div className="ba-stage">
      <img src={resolveImg(after)} alt={`${title}: after`} draggable="false" />
      <img src={resolveImg(before)} alt={`${title}: before`} draggable="false" className="ba-before" style={{ clipPath: `inset(0 ${100 - p}% 0 0)` }} />
      <span className="ba-tag l">Before</span><span className="ba-tag r">After</span>
      <span className="ba-line" style={{ left: `${p}%` }}><span className="ba-knob">‹ ›</span></span>
      <input type="range" min="0" max="100" value={p} onChange={(e) => setP(Number(e.target.value))} aria-label={`Drag to compare before and after: ${title}`} />
    </div>
    <figcaption><b>{title}</b>{by && <span className="hint"> · {by}</span>}</figcaption>
  </figure>;
}
