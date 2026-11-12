import { useState } from 'react';
import { fmt, pow10, useWidth } from './LineChart.jsx';

const LO = -5, HI = -1; // log10 colour domain

function shade(v) {
  if (!(v > 0)) return 'var(--surface-2)';
  const a = Math.max(0, Math.min(1, (Math.log10(v) - LO) / (HI - LO)));
  return `color-mix(in oklab, var(--s1) ${Math.round(8 + a * 92)}%, var(--surface-2))`;
}

/**
 * Error map: rows = coupling ratios, columns = normalised time bins, cell = max |Δc₁| in the bin.
 * Sequential single-hue log scale. Hover a cell for its value; click a row to focus that R.
 */
export default function ErrorMap({ cases, focusR, onPick }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const bins = cases[0]?.emap.length || 60;
  const m = { l: 42, r: 8, t: 6, b: 30 };
  const rowH = width < 520 ? 13 : 16;
  const iw = Math.max(10, width - m.l - m.r), ih = rowH * cases.length;
  const cw = iw / bins;
  const H = ih + m.t + m.b;

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - m.l, y = e.clientY - rect.top - m.t;
    const j = Math.floor(x / cw), i = Math.floor(y / rowH);
    if (i < 0 || i >= cases.length || j < 0 || j >= bins) { setHover(null); return; }
    setHover({ i, j, px: m.l + (j + 0.5) * cw, py: m.t + i * rowH });
  };

  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Error map of max |Δc₁| over normalised time and coupling ratio"
          onPointerMove={onMove} onPointerDown={onMove}
          onPointerLeave={(e) => { if (e.pointerType !== 'touch') setHover(null); }}
          onClick={() => hover && onPick(cases[hover.i].R)} style={{ cursor: 'pointer' }}>
          {cases.map((c, i) => (
            <g key={c.R}>
              <text className="tick" x={m.l - 6} y={m.t + i * rowH + rowH / 2} dy="0.32em" textAnchor="end"
                style={c.R === focusR ? { fill: 'var(--ink)', fontWeight: 700 } : undefined}>{c.R}</text>
              {c.emap.map((v, j) => (
                <rect key={j} x={m.l + j * cw} y={m.t + i * rowH + 1} width={Math.max(0.5, cw - 0.6)} height={rowH - 2} fill={shade(v)} />
              ))}
            </g>
          ))}
          {cases.map((c, i) => c.R === focusR && (
            <rect key="f" x={m.l - 1} y={m.t + i * rowH} width={iw + 2} height={rowH} fill="none" stroke="var(--ink)" strokeWidth="1.5" rx="2" />
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} className="tick" x={m.l + f * iw} y={H - 14} textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{f}</text>
          ))}
          <text className="axis-label" x={m.l + iw / 2} y={H - 1} textAnchor="middle">t / t_max</text>
          {hover && <rect x={m.l + hover.j * cw - 0.5} y={hover.py} width={cw + 0.4} height={rowH} fill="none" stroke="var(--ink)" strokeWidth="1" pointerEvents="none" />}
        </svg>
      )}
      {hover && (
        <div className="chart-tip" style={{ left: hover.px, top: hover.py + rowH + 6, transform: hover.px > width * 0.6 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}>
          <div className="tip-x">R = {cases[hover.i].R} · t/t_max ∈ [{(hover.j / bins).toFixed(2)}, {((hover.j + 1) / bins).toFixed(2)})</div>
          <div className="tip-row">max |Δc₁|<b>{fmt(cases[hover.i].emap[hover.j], 3)}</b></div>
        </div>
      )}
      <div className="heat-legend">
        <span>{pow10(LO)}</span>
        <span className="bar" style={{ background: 'linear-gradient(90deg, color-mix(in oklab, var(--s1) 8%, var(--surface-2)), var(--s1))' }} />
        <span>{pow10(HI)}</span>
        <span style={{ marginLeft: 'auto' }}>max |Δc₁| per bin (log)</span>
      </div>
    </div>
  );
}
