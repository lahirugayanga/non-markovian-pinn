export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

export function Seg({ options, value, onChange, label }) {
  return (
    <div className="filter">
      <span className="filter-label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button type="button" key={String(o.value)} className="chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

export function Select({ options, value, onChange, label }) {
  return (
    <label className="filter">
      <span className="filter-label">{label}</span>
      <select className="select" value={String(value)} onChange={(e) => {
        const o = options.find((x) => String(x.value) === e.target.value);
        onChange(o ? o.value : e.target.value);
      }}>
        {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Card({ title, sub, span = 6, right, children, className = '' }) {
  return (
    <section className={`card span-${span} ${className}`}>
      <header className="card-head">
        <div>
          <h2 className="card-title">{title}</h2>
          {sub && <div className="card-sub">{sub}</div>}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

export function Kpi({ k, v, d, accent }) {
  return (
    <div className={`kpi ${accent ? 'accent' : ''}`}>
      <div className="kpi-k">{k}</div>
      <div className="kpi-v">{v}</div>
      {d && <div className="kpi-d">{d}</div>}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span className="legend-item" key={it.label}>
          {it.type === 'dot'
            ? <svg width="12" height="12" aria-hidden><circle cx="6" cy="6" r="4" fill={it.color} /></svg>
            : <svg width="20" height="10" aria-hidden><line x1="1" y1="5" x2="19" y2="5" stroke={it.color} strokeWidth="2" strokeDasharray={it.dash} strokeLinecap="round" /></svg>}
          {it.label}
        </span>
      ))}
    </div>
  );
}
