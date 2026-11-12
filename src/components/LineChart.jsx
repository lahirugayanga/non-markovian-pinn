import { useEffect, useId, useMemo, useRef, useState } from 'react';

// ---------- helpers ----------
export function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const pow10 = (k) => (k === 0 ? '1' : k === 1 ? '10' : '10' + String(k).split('').map((c) => SUP[c]).join(''));

export function fmt(v, digits = 3) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1e5 || a < 1e-3) {
    const [m, e] = v.toExponential(Math.max(0, digits - 1)).split('e');
    return `${m}×${pow10(+e)}`;
  }
  return String(+v.toPrecision(digits));
}

function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}
function linTicks(a, b, count) {
  if (!(b > a)) return [a];
  const step = niceStep((b - a) / Math.max(1, count));
  const out = [];
  for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}
function logTicks(a, b, maxCount = 6) {
  const lo = Math.ceil(Math.log10(a) - 1e-9), hi = Math.floor(Math.log10(b) + 1e-9);
  let ks = [];
  for (let k = lo; k <= hi; k++) ks.push(k);
  const every = Math.ceil(ks.length / maxCount);
  if (every > 1) ks = ks.filter((k) => (k - lo) % every === 0);
  return ks.map((k) => 10 ** k);
}
function lowerBound(xs, x) {
  let lo = 0, hi = xs.length - 1;
  if (hi < 0) return -1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && Math.abs(xs[lo - 1] - x) <= Math.abs(xs[lo] - x)) return lo - 1;
  return lo;
}

function autoDomain(series, key, log) {
  let lo = Infinity, hi = -Infinity;
  for (const s of series) {
    const arrs = s.type === 'band' && key === 'y' ? [s.lo, s.hi] : [s[key]];
    for (const arr of arrs) {
      if (!arr) continue;
      for (const v of arr) if (Number.isFinite(v) && (!log || v > 0)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
  }
  if (!Number.isFinite(lo)) return [0, 1];
  if (log) return [10 ** Math.floor(Math.log10(lo)), 10 ** Math.ceil(Math.log10(hi))];
  if (lo === hi) return [lo - 1, hi + 1];
  const pad = key === 'y' ? (hi - lo) * 0.06 : 0;
  return [lo - pad, hi + pad];
}

export function Swatch({ s }) {
  if (s.type === 'dots') return <svg width="14" height="12" aria-hidden><circle cx="7" cy="6" r="4" fill={s.color} /></svg>;
  if (s.type === 'band') return <svg width="18" height="12" aria-hidden><rect x="0" y="2" width="18" height="8" rx="2" fill={s.color} opacity="0.22" /></svg>;
  return (
    <svg width="20" height="10" aria-hidden>
      <line x1="1" y1="5" x2="19" y2="5" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={s.dash || undefined} strokeLinecap="round" />
    </svg>
  );
}

/**
 * Responsive SVG line chart with crosshair tooltip.
 * series: [{ id, label, color, x, y, type: 'line'|'dots'|'band', dash, width, lo, hi, yErr, hideInLegend, hideInTip }]
 */
export default function LineChart({
  series, xLabel, yLabel, xDomain, yDomain, xLog = false, yLog = false, height, aspect = 0.58,
  vlines = [], hlines = [], bands = [], xFmt = fmt, yFmt = fmt, legend = true, caption, ariaLabel,
  onScrub, scrubX, minHeight = 210, maxHeight = 340, table = true, onPick,
}) {
  const [ref, width] = useWidth();
  const clipId = useId().replace(/:/g, '');
  const [hoverX, setHoverX] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const H = height || Math.round(Math.min(maxHeight, Math.max(minHeight, width * aspect)));
  const m = { l: 50, r: 14, t: 10, b: xLabel ? 42 : 26 };
  const iw = Math.max(10, width - m.l - m.r), ih = Math.max(10, H - m.t - m.b);

  const [x0, x1] = useMemo(() => xDomain || autoDomain(series, 'x', xLog), [xDomain, series, xLog]);
  const [y0, y1] = useMemo(() => yDomain || autoDomain(series, 'y', yLog), [yDomain, series, yLog]);
  const tx = (v) => (xLog ? Math.log10(v) : v);
  const ty = (v) => (yLog ? Math.log10(v) : v);
  const X0 = tx(x0), X1 = tx(x1), Y0 = ty(y0), Y1 = ty(y1);
  const sx = (v) => m.l + ((tx(v) - X0) / (X1 - X0)) * iw;
  const syRaw = (v) => m.t + ih - ((ty(v) - Y0) / (Y1 - Y0)) * ih;
  const sy = (v) => Math.max(m.t - 4 * ih, Math.min(m.t + 5 * ih, syRaw(v)));
  const invX = (px) => { const t = X0 + ((px - m.l) / iw) * (X1 - X0); return xLog ? 10 ** t : t; };

  const xticks = xLog ? logTicks(x0, x1) : linTicks(x0, x1, Math.max(3, Math.floor(iw / 72)));
  const yticks = yLog ? logTicks(y0, y1, Math.max(3, Math.floor(ih / 40))) : linTicks(y0, y1, Math.max(3, Math.floor(ih / 46)));

  const paths = useMemo(() => {
    if (!width) return [];
    return series.map((s) => {
      if (s.type === 'dots') return null;
      if (s.type === 'band') {
        let top = '', bot = '';
        for (let i = 0; i < s.x.length; i++) {
          if (!Number.isFinite(s.lo[i]) || !Number.isFinite(s.hi[i])) continue;
          top += `${top ? 'L' : 'M'}${sx(s.x[i]).toFixed(1)},${sy(s.hi[i]).toFixed(1)}`;
        }
        for (let i = s.x.length - 1; i >= 0; i--) {
          if (!Number.isFinite(s.lo[i]) || !Number.isFinite(s.hi[i])) continue;
          bot += `L${sx(s.x[i]).toFixed(1)},${sy(Math.max(s.lo[i], yLog ? y0 : -Infinity)).toFixed(1)}`;
        }
        return top + bot + 'Z';
      }
      let d = '', pen = false, prevOut = 0;
      for (let i = 0; i < s.x.length; i++) {
        const xv = s.x[i], yv = s.y[i];
        if (!Number.isFinite(yv) || (yLog && yv <= 0) || (xLog && xv <= 0)) { pen = false; continue; }
        const out = yv > y1 ? 1 : yv < y0 ? -1 : 0;
        if (pen && out !== 0 && prevOut !== 0 && out !== prevOut) pen = false; // jump across a pole
        d += `${pen ? 'L' : 'M'}${sx(xv).toFixed(1)},${sy(yv).toFixed(1)}`;
        pen = true;
        prevOut = out;
      }
      return d;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, width, H, x0, x1, y0, y1, xLog, yLog]);

  const activeX = hoverX ?? scrubX ?? null;
  const tipRows = useMemo(() => {
    if (activeX === null) return [];
    return series
      .filter((s) => !s.hideInTip && s.type !== 'band' && s.x.length)
      .map((s) => {
        const i = lowerBound(s.x, activeX);
        return { s, i, x: s.x[i], y: s.y[i] };
      })
      .filter((r) => r.i >= 0 && Math.abs(sx(r.x) - sx(activeX)) < Math.max(24, iw / 8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeX, series, width]);

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < m.l - 6 || px > m.l + iw + 6) return;
    const xv = invX(Math.max(m.l, Math.min(m.l + iw, px)));
    setHoverX(xv);
    if (onScrub) onScrub(xv);
  };

  const legendItems = series.filter((s) => !s.hideInLegend && s.label);
  const tipLeft = activeX !== null ? sx(activeX) : 0;
  const flip = tipLeft > m.l + iw * 0.55;

  // Data table (sampled)
  const tableData = useMemo(() => {
    if (!showTable) return null;
    const lines = series.filter((s) => s.type !== 'band' && s.x.length);
    if (!lines.length) return null;
    const base = lines[0];
    const n = base.x.length, k = Math.max(1, Math.ceil(n / 14));
    const rows = [];
    for (let i = 0; i < n; i += k) rows.push(base.x[i]);
    if ((n - 1) % k) rows.push(base.x[n - 1]);
    return { lines, rows };
  }, [showTable, series]);

  return (
    <div className="chart" ref={ref}>
      {legend && legendItems.length > 1 && (
        <div className="legend">
          {legendItems.map((s) => (
            <span className="legend-item" key={s.id}><Swatch s={s} />{s.label}</span>
          ))}
        </div>
      )}
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label={ariaLabel || `${yLabel || 'y'} versus ${xLabel || 'x'}`}
          onPointerMove={handleMove} onPointerDown={handleMove}
          onClick={onPick ? (e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onPick(invX(Math.max(m.l, Math.min(m.l + iw, e.clientX - rect.left))));
          } : undefined}
          style={onPick ? { cursor: 'pointer' } : undefined}
          onPointerLeave={(e) => { if (e.pointerType !== 'touch') setHoverX(null); }}>
          <defs>
            <clipPath id={clipId}><rect x={m.l} y={m.t} width={iw} height={ih} /></clipPath>
          </defs>
          {/* grid */}
          {yticks.map((v) => (
            <g key={`y${v}`}>
              <line x1={m.l} x2={m.l + iw} y1={syRaw(v)} y2={syRaw(v)} stroke="var(--grid)" strokeWidth="1" />
              <text className="tick" x={m.l - 6} y={syRaw(v)} dy="0.32em" textAnchor="end">{yLog ? pow10(Math.round(Math.log10(v))) : yFmt(v)}</text>
            </g>
          ))}
          {xticks.map((v) => (
            <text key={`x${v}`} className="tick" x={sx(v)} y={m.t + ih + 16} textAnchor="middle">{xLog ? pow10(Math.round(Math.log10(v))) : xFmt(v)}</text>
          ))}
          <line x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} stroke="var(--axis)" strokeWidth="1" />
          {xLabel && <text className="axis-label" x={m.l + iw / 2} y={H - 6} textAnchor="middle">{xLabel}</text>}
          {yLabel && <text className="axis-label" x={12} y={m.t + ih / 2} textAnchor="middle" transform={`rotate(-90 12 ${m.t + ih / 2})`}>{yLabel}</text>}

          <g clipPath={`url(#${clipId})`}>
            {bands.map((b, i) => (
              <rect key={`b${i}`} x={sx(Math.max(b.x0, x0))} y={m.t} width={Math.max(0, sx(Math.min(b.x1, x1)) - sx(Math.max(b.x0, x0)))} height={ih}
                fill={b.color || 'var(--crit)'} opacity={b.opacity ?? 0.07} />
            ))}
            {hlines.map((h, i) => (
              <line key={`h${i}`} x1={m.l} x2={m.l + iw} y1={syRaw(h.y)} y2={syRaw(h.y)} stroke={h.color || 'var(--axis)'} strokeWidth="1" strokeDasharray={h.dash || '4 4'} />
            ))}
            {vlines.map((v, i) => (
              <line key={`v${i}`} x1={sx(v.x)} x2={sx(v.x)} y1={m.t} y2={m.t + ih} stroke={v.color || 'var(--muted)'} strokeWidth="1" strokeDasharray={v.dash ?? '3 4'} />
            ))}
            {series.map((s, k) => {
              if (s.type === 'band') return <path key={s.id} d={paths[k]} fill={s.color} opacity={s.opacity ?? 0.16} />;
              if (s.type === 'dots') {
                return (
                  <g key={s.id}>
                    {Array.from(s.x, (xv, i) => {
                      const yv = s.y[i];
                      if (!Number.isFinite(yv)) return null;
                      const e = s.yErr ? s.yErr[i] : 0;
                      return (
                        <g key={i}>
                          {e > 0 && <line x1={sx(xv)} x2={sx(xv)} y1={sy(yv - e)} y2={sy(yv + e)} stroke={s.color} strokeWidth="1.5" />}
                          <circle cx={sx(xv)} cy={sy(yv)} r={s.r || 4} fill={s.color} stroke="var(--surface)" strokeWidth="2" />
                        </g>
                      );
                    })}
                  </g>
                );
              }
              return <path key={s.id} d={paths[k]} fill="none" stroke={s.color} strokeWidth={s.width || 2} strokeDasharray={s.dash || undefined}
                strokeLinejoin="round" strokeLinecap="round" opacity={s.opacity ?? 1} />;
            })}
          </g>
          {vlines.filter((v) => v.label).map((v, i) => (
            <text key={`vl${i}`} className="ann" x={sx(v.x) + 4} y={m.t + 12}>{v.label}</text>
          ))}
          {activeX !== null && activeX >= Math.min(x0, x1) && activeX <= Math.max(x0, x1) && (
            <g pointerEvents="none">
              <line x1={sx(activeX)} x2={sx(activeX)} y1={m.t} y2={m.t + ih} stroke="var(--ink-2)" strokeWidth="1" opacity="0.5" />
              {tipRows.map((r) => Number.isFinite(r.y) && r.y >= Math.min(y0, y1) && r.y <= Math.max(y0, y1) && (
                <circle key={r.s.id} cx={sx(r.x)} cy={syRaw(r.y)} r="4.5" fill={r.s.color} stroke="var(--surface)" strokeWidth="2" />
              ))}
            </g>
          )}
          {/* transparent hit area */}
          <rect x={m.l - 6} y={0} width={iw + 12} height={H} fill="transparent" />
        </svg>
      )}
      {hoverX !== null && tipRows.length > 0 && (
        <div className="chart-tip" style={{ left: tipLeft, top: m.t + 26, transform: flip ? 'translateX(calc(-100% - 14px))' : 'translateX(14px)' }}>
          <div className="tip-x">{xLabel ? `${xLabel.split(' ')[0]} = ` : ''}{xFmt(tipRows[0].x)}</div>
          {tipRows.map((r) => (
            <div className="tip-row" key={r.s.id}><Swatch s={r.s} />{r.s.names ? r.s.names[r.i] : r.s.label || r.s.id}<b>{yFmt(r.y)}</b></div>
          ))}
        </div>
      )}
      {(caption || table) && (
        <div className="chart-foot">
          <div className="chart-caption">{caption}</div>
          {table && <button type="button" className="link-btn" onClick={() => setShowTable((v) => !v)}>{showTable ? 'Hide data' : 'View data'}</button>}
        </div>
      )}
      {tableData && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th className="num">{xLabel || 'x'}</th>{tableData.lines.map((s) => <th className="num" key={s.id}>{s.label || s.id}</th>)}</tr>
            </thead>
            <tbody>
              {tableData.rows.map((xv, i) => (
                <tr key={i}>
                  <td className="num">{xFmt(xv)}</td>
                  {tableData.lines.map((s) => <td className="num" key={s.id}>{fmt(s.y[lowerBound(s.x, xv)], 4)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
