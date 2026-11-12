import { useMemo, useState } from 'react';
import { fmt, pow10, useWidth } from './LineChart.jsx';

/**
 * Dot strip: one column per coupling ratio, one dot per random seed, a bar for the mean.
 * Log y-axis. Nearest-dot hover (24px radius); click a column to focus that R.
 */
export default function SeedStrip({ groups, metric, metricLabel, focusR, onPick }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const H = Math.round(Math.min(300, Math.max(220, width * 0.6)));
  const m = { l: 48, r: 10, t: 10, b: 34 };
  const iw = Math.max(10, width - m.l - m.r), ih = H - m.t - m.b;

  const all = groups.flatMap((g) => g.runs.map((r) => r[metric]));
  const lo = 10 ** Math.floor(Math.log10(Math.min(...all)));
  const hi = 10 ** Math.ceil(Math.log10(Math.max(...all)));
  const sy = (v) => m.t + ih - ((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * ih;
  const colW = iw / groups.length;
  const cx = (gi) => m.l + (gi + 0.5) * colW;

  const dots = useMemo(() => groups.flatMap((g, gi) => g.runs.map((r, k) => ({
    g, r, x: cx(gi) + ((k % 5) - 2) * Math.min(5, colW / 12) + (k >= 5 ? Math.min(2.5, colW / 24) : 0), y: sy(r[metric]),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }))), [groups, metric, width, H]);

  const ticks = [];
  for (let k = Math.log10(lo); k <= Math.log10(hi) + 1e-9; k++) ticks.push(k);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let best = null, bd = 24 * 24;
    for (const d of dots) { const dd = (d.x - x) ** 2 + (d.y - y) ** 2; if (dd < bd) { bd = dd; best = d; } }
    const gi = Math.floor((x - m.l) / colW);
    setHover(best ? { ...best, gi } : gi >= 0 && gi < groups.length ? { gi } : null);
  };

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={`${metricLabel} for each of 10 seeds per coupling ratio`}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType !== 'touch') setHover(null); }}
          onClick={() => hover && hover.gi >= 0 && onPick(groups[hover.gi].R)} style={{ cursor: 'pointer' }}>
          {groups.map((g, gi) => g.R === focusR && (
            <rect key="f" x={m.l + gi * colW + 2} y={m.t} width={colW - 4} height={ih} rx="6" fill="var(--accent-wash)" />
          ))}
          {ticks.map((k) => (
            <g key={k}>
              <line x1={m.l} x2={m.l + iw} y1={sy(10 ** k)} y2={sy(10 ** k)} stroke="var(--grid)" />
              <text className="tick" x={m.l - 6} y={sy(10 ** k)} dy="0.32em" textAnchor="end">{pow10(k)}</text>
            </g>
          ))}
          <text className="axis-label" x={12} y={m.t + ih / 2} textAnchor="middle" transform={`rotate(-90 12 ${m.t + ih / 2})`}>{metricLabel}</text>
          {groups.map((g, gi) => (
            <g key={g.R}>
              <text className="tick" x={cx(gi)} y={m.t + ih + 16} textAnchor="middle" style={g.R === focusR ? { fill: 'var(--ink)', fontWeight: 700 } : undefined}>{g.R}</text>
              <line x1={cx(gi) - Math.min(14, colW * 0.38)} x2={cx(gi) + Math.min(14, colW * 0.38)} y1={sy(g.mean[metric])} y2={sy(g.mean[metric])} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
          <text className="axis-label" x={m.l + iw / 2} y={H - 2} textAnchor="middle">coupling ratio R</text>
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={hover && hover.r === d.r ? 5.5 : 4} fill="var(--s2)" fillOpacity="0.75" stroke="var(--surface)" strokeWidth="1.5" />
          ))}
        </svg>
      )}
      {hover && hover.r && (
        <div className="chart-tip" style={{ left: hover.x, top: Math.max(0, hover.y - 64), transform: hover.x > width * 0.6 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)' }}>
          <div className="tip-x">R = {hover.g.R} · seed {hover.r.seed}</div>
          <div className="tip-row">{metricLabel}<b>{fmt(hover.r[metric], 3)}</b></div>
          <div className="tip-row">mean over seeds<b>{fmt(hover.g.mean[metric], 3)}</b></div>
          <div className="tip-row">final loss<b>{fmt(hover.r.loss, 2)}</b></div>
        </div>
      )}
    </div>
  );
}
