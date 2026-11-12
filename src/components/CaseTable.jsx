import { useMemo, useState } from 'react';
import { fmt } from './LineChart.jsx';

export const COLUMNS = [
  { key: 'R', label: 'R', num: true, f: (v) => String(v) },
  { key: 'regime', label: 'Regime', f: (v) => (v === 'weak' ? 'Weak (R < ½)' : 'Strong (R > ½)') },
  { key: 'tmax', label: 't_max', num: true, f: (v) => v.toFixed(1) },
  { key: 'epochs', label: 'Epochs', num: true, f: (v) => v.toLocaleString() },
  { key: 'nc', label: 'N_c / N_q', num: true, f: (v, c) => `${v} / ${c.nq}` },
  { key: 'maxC', label: 'max |Δc₁|', num: true, f: (v) => fmt(v, 3) },
  { key: 'rmseC', label: 'RMSE(c₁)', num: true, f: (v) => fmt(v, 3) },
  { key: 'maxF', label: 'max |ΔF|', num: true, f: (v) => fmt(v, 3) },
  { key: 'rmseF', label: 'RMSE(F)', num: true, f: (v) => fmt(v, 3) },
  { key: 'finalLoss', label: 'Final loss', num: true, f: (v) => fmt(v, 2) },
  { key: 'ep1e5', label: 'Epoch @ loss < 10⁻⁵', num: true, f: (v) => (v ? v.toLocaleString() : '—') },
];

function toCSV(rows) {
  const keys = ['R', 'regime', 'tmax', 'epochs', 'nc', 'nq', 'maxC', 'rmseC', 'maxF', 'rmseF', 'odeMax', 'finalLoss', 'minLoss', 'finalRes', 'ep1e5', 'ep1e6'];
  return [keys.join(','), ...rows.map((r) => keys.map((k) => r[k] ?? '').join(','))].join('\n');
}

export default function CaseTable({ cases, focusR, onPick }) {
  const [sort, setSort] = useState({ key: 'R', dir: 1 });
  const rows = useMemo(() => [...cases].sort((a, b) => {
    const x = a[sort.key], y = b[sort.key];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (x < y ? -1 : 1) * sort.dir;
  }), [cases, sort]);

  const download = () => {
    const blob = new Blob([toCSV(rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pinn_sweep_metrics.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div className="table-tools">
        <span className="card-sub">{rows.length} cases · click a header to sort, a row to focus</span>
        <button type="button" className="btn small" onClick={download}>Download CSV</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={c.num ? 'num' : ''} aria-sort={sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className="th-btn" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))}>
                    {c.label}{sort.key === c.key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.R} className={r.R === focusR ? 'focus' : ''} onClick={() => onPick(r.R)} tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onPick(r.R); }}>
                {COLUMNS.map((c) => <td key={c.key} className={c.num ? 'num' : ''}>{c.f(r[c.key], r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
