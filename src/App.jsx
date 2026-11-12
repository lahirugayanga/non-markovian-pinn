import { useEffect, useMemo, useState } from 'react';
import data from './data/results.json';
import LineChart, { fmt } from './components/LineChart.jsx';
import ErrorMap from './components/ErrorMap.jsx';
import SeedStrip from './components/SeedStrip.jsx';
import CaseTable from './components/CaseTable.jsx';
import { Card, Kpi, Seg, Select, store } from './components/ui.jsx';

const METRICS = {
  maxC: { label: 'max |Δc₁|', short: 'max|Δc₁|' },
  rmseC: { label: 'RMSE(c₁)', short: 'RMSE(c₁)' },
  maxF: { label: 'max |ΔF|', short: 'max|ΔF|' },
  rmseF: { label: 'RMSE(F)', short: 'RMSE(F)' },
};
const ROLE = {
  exact: { color: 'var(--s1)' },
  ode: { color: 'var(--s3)', dash: '2 4' },
  pinn: { color: 'var(--s2)', dash: '7 4' },
};
const fid = (c) => ((1 + c) * (1 + c)) / 4;
const median = (a) => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const logDomain = (vals) => {
  const v = vals.filter((x) => x > 0);
  return [10 ** Math.floor(Math.log10(Math.min(...v))), 10 ** Math.ceil(Math.log10(Math.max(...v)))];
};
const nearestR = (cases, x) => cases.reduce((b, c) => (Math.abs(Math.log(c.R) - Math.log(x)) < Math.abs(Math.log(b.R) - Math.log(x)) ? c : b)).R;

function useTheme() {
  const [theme, setTheme] = useState(() => store.get('theme', null));
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    store.set('theme', theme);
  }, [theme]);
  const sysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dark = theme ? theme === 'dark' : sysDark;
  return [dark, () => setTheme(dark ? 'light' : 'dark')];
}

export default function App() {
  const [dark, toggleTheme] = useTheme();
  const [regime, setRegime] = useState(() => store.get('dash:regime', 'all'));
  const [metric, setMetric] = useState(() => store.get('dash:metric', 'maxC'));
  const [focusR, setFocusR] = useState(() => store.get('dash:focus', 2));
  useEffect(() => { store.set('dash:regime', regime); store.set('dash:metric', metric); store.set('dash:focus', focusR); }, [regime, metric, focusR]);

  const cases = useMemo(() => data.cases.filter((c) => regime === 'all' || c.regime === regime), [regime]);
  const seeds = useMemo(() => data.seeds.filter((s) => regime === 'all' || (regime === 'weak' ? s.R < 0.5 : s.R > 0.5)), [regime]);
  useEffect(() => { if (!cases.some((c) => c.R === focusR)) setFocusR(cases[0].R); }, [cases, focusR]);
  const focus = cases.find((c) => c.R === focusR) || cases[0];
  const M = METRICS[metric];

  // ---- KPIs (scoped by the regime filter) ----
  const vals = cases.map((c) => c[metric]);
  const best = cases.reduce((a, c) => (c[metric] < a[metric] ? c : a));
  const worst = cases.reduce((a, c) => (c[metric] > a[metric] ? c : a));
  const cv = median(seeds.map((s) => s.std[metric] / s.mean[metric]));
  const ep = median(cases.map((c) => c.ep1e5).filter(Boolean));

  // ---- Overview: metric vs R ----
  const xs = cases.map((c) => c.R);
  const seedLo = seeds.map((s) => Math.max(s.mean[metric] - s.std[metric], s.mean[metric] * 0.05));
  const seedHi = seeds.map((s) => s.mean[metric] + s.std[metric]);
  const overDomain = logDomain([...vals, ...seedLo, ...seedHi]);
  const overview = [
    { id: 'band', label: '10-seed mean ± 1σ', color: 'var(--s2)', type: 'band', x: seeds.map((s) => s.R), lo: seedLo, hi: seedHi },
    { id: 'seedmean', label: '10-seed mean', color: 'var(--s2)', dash: '7 4', x: seeds.map((s) => s.R), y: seeds.map((s) => s.mean[metric]), hideInLegend: true },
    { id: 'sweep', label: 'Single run (paper sweep)', color: 'var(--s1)', x: xs, y: vals },
    { id: 'pts', label: 'cases', color: 'var(--s1)', type: 'dots', x: xs, y: vals, r: 3.5, hideInLegend: true, hideInTip: true },
    { id: 'focus', label: 'focus', color: 'var(--ink)', type: 'dots', x: [focus.R], y: [focus[metric]], r: 6, hideInLegend: true, hideInTip: true },
  ];

  // ---- Focus detail ----
  const cu = focus.curve;
  const errT = cu.pinn.map((p, i) => Math.max(Math.abs(p - cu.exact[i]), 1e-7));

  // ---- Loss vs error scatter (sorted by x for crosshair lookup) ----
  const scatter = (rg, color, label) => {
    const pts = cases.filter((c) => c.regime === rg).sort((a, b) => a.finalLoss - b.finalLoss);
    return { id: rg, label, color, type: 'dots', x: pts.map((c) => c.finalLoss), y: pts.map((c) => c[metric]), names: pts.map((c) => `R = ${c.R}`) };
  };
  const scat = [
    ...(regime !== 'strong' ? [scatter('weak', 'var(--s1)', 'Weak coupling (R < ½)')] : []),
    ...(regime !== 'weak' ? [scatter('strong', 'var(--s2)', 'Strong coupling (R > ½)')] : []),
    { id: 'focus', label: 'focus', color: 'var(--ink)', type: 'dots', x: [focus.finalLoss], y: [focus[metric]], r: 6, hideInLegend: true, hideInTip: true },
  ];

  // ---- Kernel generality ----
  const gRows = data.gaussian.map((g) => ({ g, l: data.cases.find((c) => c.R === g.R) }));
  const gFocus = data.gaussian.find((g) => g.R === focus.R);

  // ---- Markovian ----
  const mk = data.markovian;
  const mlog = (key) => mk.log.map((e) => e[key]);
  const mIt = mk.log.map((e) => e.iter + 1);

  const cost = data.cost;
  const perEpoch = (s) => parseFloat(s);
  const speedup = perEpoch(cost[2]['Per-solve / per-epoch']) / perEpoch(cost[1]['Per-solve / per-epoch']);
  const rkVsPinn = (parseFloat(cost[1]['Total to convergence']) * 1000) / parseFloat(cost[0]['Total to convergence']);

  const pick = (x) => setFocusR(nearestR(cases, x));

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <b>PINN Results Dashboard</b>
          <span>Integro-differential PINN · non-Markovian Bell-state decay</span>
        </div>
        <button type="button" className="icon-btn" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme}>
          {dark
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
        </button>
      </header>

      <div className="filters" role="toolbar" aria-label="Dashboard filters">
        <Select label="Focus R" value={focus.R} onChange={setFocusR} options={cases.map((c) => ({ value: c.R, label: String(c.R) }))} />
        <Seg label="Regime" value={regime} onChange={setRegime}
          options={[{ value: 'all', label: 'All' }, { value: 'weak', label: 'R < ½' }, { value: 'strong', label: 'R > ½' }]} />
        <Select label="Metric" value={metric} onChange={setMetric} options={Object.entries(METRICS).map(([k, v]) => ({ value: k, label: v.label }))} />
      </div>

      <main className="dash">
        <div className="kpis">
          <Kpi k="Coupling ratios" v={`${cases.length}`} d={`R ∈ [${cases[0].R}, ${cases.at(-1).R}] of 20`} />
          <Kpi k={`Median ${M.short}`} v={fmt(median(vals), 2)} d="single-run sweep" accent />
          <Kpi k={`Best ${M.short}`} v={fmt(best[metric], 2)} d={`at R = ${best.R}`} />
          <Kpi k={`Worst ${M.short}`} v={fmt(worst[metric], 2)} d={`at R = ${worst.R}`} />
          <Kpi k="Seed spread (σ/mean)" v={Number.isFinite(cv) ? `${Math.round(cv * 100)}%` : '—'} d={`median over ${seeds.length} ratios × 10 seeds`} />
          <Kpi k="Epochs to loss < 10⁻⁵" v={Number.isFinite(ep) ? Math.round(ep).toLocaleString() : '—'} d="median" />
        </div>

        <h2 className="section">Across coupling ratios</h2>
        <Card span={7} title={`${M.label} vs coupling ratio`} sub="Tap or click to focus a ratio. Dashed line marks the Markovian threshold R = ½.">
          <LineChart series={overview} xLabel="R" yLabel={M.short} xLog yLog xDomain={[0.08, 12]} yDomain={overDomain}
            vlines={[{ x: 0.5, label: 'R = ½' }]} onPick={pick} aspect={0.56} />
        </Card>
        <Card span={5} title="Error map" sub="max |Δc₁| over normalised time, one row per ratio. Click a row to focus.">
          <ErrorMap cases={cases} focusR={focus.R} onPick={setFocusR} />
        </Card>

        <h2 className="section">Focus · {focus.label} <span className="muted">· t_max = {focus.tmax.toFixed(1)}/λ · {focus.epochs.toLocaleString()} epochs · N_c/N_q = {focus.nc}/{focus.nq}</span></h2>
        <div className="kpis span-12 inner">
          <Kpi k="max |Δc₁|" v={fmt(focus.maxC, 3)} />
          <Kpi k="RMSE(c₁)" v={fmt(focus.rmseC, 3)} />
          <Kpi k="max |ΔF|" v={fmt(focus.maxF, 3)} />
          <Kpi k="RMSE(F)" v={fmt(focus.rmseF, 3)} />
          <Kpi k="Final loss" v={fmt(focus.finalLoss, 2)} />
          <Kpi k="RK45 vs exact" v={fmt(focus.odeMax, 2)} d="max |Δc₁|, reference check" />
        </div>
        <Card span={6} title="Amplitude c₁(t)" sub="Closed form vs RK45 auxiliary ODE vs PINN">
          <LineChart series={[
            { id: 'ex', label: 'Exact', ...ROLE.exact, x: cu.t, y: cu.exact },
            { id: 'ode', label: 'RK45 aux. ODE', ...ROLE.ode, x: cu.t, y: cu.ode },
            { id: 'pinn', label: 'PINN', ...ROLE.pinn, x: cu.t, y: cu.pinn },
          ]} xLabel="t (1/λ)" yLabel="c₁" hlines={[{ y: 0 }]} aspect={0.58} />
        </Card>
        <Card span={6} title="Bell fidelity F(t) = (1 + c₁)²/4" sub="Dashed: F = ¼ (fully mixed)">
          <LineChart series={[
            { id: 'ex', label: 'Exact', ...ROLE.exact, x: cu.t, y: cu.exact.map(fid) },
            { id: 'pinn', label: 'PINN', ...ROLE.pinn, x: cu.t, y: cu.pinn.map(fid) },
          ]} xLabel="t (1/λ)" yLabel="F" yDomain={[0, 1.02]} hlines={[{ y: 0.25, dash: '2 4' }]} aspect={0.58} />
        </Card>
        <Card span={6} title="Pointwise error |c₁ − ĉ₁|" sub="Log scale">
          <LineChart series={[{ id: 'e', label: '|Δc₁|', color: 'var(--s2)', x: cu.t, y: errT }]}
            xLabel="t (1/λ)" yLabel="|Δc₁|" yLog yDomain={[1e-6, 1]} aspect={0.5} />
        </Card>
        <Card span={6} title="Training convergence" sub="Adam with cosine annealing; log–log">
          <LineChart series={[
            { id: 'l', label: 'loss (mean r²)', color: 'var(--s1)', x: focus.hist.epoch, y: focus.hist.loss },
            { id: 'r', label: 'max |r|', color: 'var(--s3)', dash: '2 4', x: focus.hist.epoch, y: focus.hist.res },
          ]} xLabel="epoch" yLabel="value" xLog yLog aspect={0.5}
            vlines={focus.ep1e5 ? [{ x: focus.ep1e5, label: 'loss < 10⁻⁵' }] : []} />
        </Card>

        <h2 className="section">Robustness & diagnostics</h2>
        <Card span={6} title={`Seed robustness · ${M.label}`} sub="10 independent runs per ratio (weights + collocation re-drawn). Bar = mean.">
          {seeds.length ? <SeedStrip groups={seeds} metric={metric} metricLabel={M.short} focusR={focus.R} onPick={setFocusR} />
            : <p className="card-sub">No seed runs in this regime.</p>}
        </Card>
        <Card span={6} title={`Final loss vs ${M.label}`} sub="One dot per ratio. Final losses span four decades while the error moves by about one, so the error floor is not set by the optimiser.">
          <LineChart series={scat} xLabel="final training loss" yLabel={M.short} xLog yLog
            xDomain={logDomain(cases.map((c) => c.finalLoss))} yDomain={logDomain(vals)} aspect={0.62} />
        </Card>

        <h2 className="section">Generality & cost</h2>
        <Card span={6} title="Lorentzian vs Gaussian kernel" sub={`Same network and training; ${M.label} at matched R`}>
          <div className="table-wrap">
            <table>
              <thead><tr><th className="num">R</th><th className="num">Lorentzian</th><th className="num">Gaussian</th><th className="num">Gauss / Lor</th></tr></thead>
              <tbody>{gRows.map(({ g, l }) => (
                <tr key={g.R} className={g.R === focus.R ? 'focus' : ''} onClick={() => cases.some((c) => c.R === g.R) && setFocusR(g.R)}>
                  <td className="num">{g.R}</td><td className="num">{fmt(l[metric], 3)}</td><td className="num">{fmt(g[metric], 3)}</td>
                  <td className="num">{(g[metric] / l[metric]).toFixed(2)}×</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {gFocus ? (
            <LineChart series={[
              { id: 'ref', label: 'Volterra reference (Gaussian)', ...ROLE.exact, x: gFocus.curve.t, y: gFocus.curve.ref },
              { id: 'pinn', label: 'PINN (Gaussian)', ...ROLE.pinn, x: gFocus.curve.t, y: gFocus.curve.pinn },
            ]} xLabel="t (1/λ)" yLabel="c₁" hlines={[{ y: 0 }]} aspect={0.5} />
          ) : (
            <p className="card-sub">Focus R = 0.6, 1 or 2 (click a row) to overlay the Gaussian-kernel run.</p>
          )}
        </Card>
        <Card span={6} title="Wall-clock cost" sub="R = 1, N_c = 250, N_q = 500 (paper benchmark)">
          <div className="kpis two">
            <Kpi k="Vectorised memory integral" v={`${speedup.toFixed(1)}×`} d="faster per epoch than the loop" accent />
            <Kpi k="RK45 vs PINN training" v={`≈${Math.round(rkVsPinn)}×`} d="RK45 cheaper for this forward problem" />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Method</th><th className="num">Per solve / epoch</th><th className="num">To convergence</th><th>HW</th></tr></thead>
              <tbody>{cost.map((c) => (
                <tr key={c.Method}><td>{c.Method}</td><td className="num">{c['Per-solve / per-epoch']}</td><td className="num">{c['Total to convergence']}</td><td>{c.Hardware}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
        <Card span={12} title="Markovian baseline (Lindblad PINN)" sub={`${mk.architecture.join(' → ')} · ${mk.n_params} parameters · ${mk.optimizer}, ${mk.n_iterations.toLocaleString()} iterations · ${Math.round(mk.training_time_seconds)} s`}>
          <div className="split">
            <div className="kpis two">
              <Kpi k="Final loss" v={fmt(mk.final_loss, 2)} />
              <Kpi k="max |ΔF| vs RK45" v={fmt(mk.validation.max_F_error, 2)} accent />
              <Kpi k="max trace error" v={fmt(mk.validation.max_trace_error, 2)} />
              <Kpi k="MSE(ρ)" v={fmt(mk.validation.mse_rho_dense, 2)} />
            </div>
            <LineChart series={[
              { id: 'tot', label: 'Total', color: 'var(--ink)', x: mIt, y: mlog('loss') },
              { id: 'phys', label: 'Physics', color: 'var(--s1)', x: mIt, y: mlog('physics') },
              { id: 'ic', label: 'Initial cond.', color: 'var(--s2)', dash: '6 4', x: mIt, y: mlog('ic') },
              { id: 'tr', label: 'Trace', color: 'var(--s3)', dash: '2 4', x: mIt, y: mlog('trace') },
              { id: 'herm', label: 'Hermiticity', color: 'var(--s7)', dash: '8 3 2 3', x: mIt, y: mlog('herm') },
            ]} xLabel="iteration + 1 (logged values)" yLabel="loss" xLog yLog aspect={0.42} maxHeight={280} />
          </div>
        </Card>

        <h2 className="section">All cases</h2>
        <Card span={12} title="Forward sweep metrics" sub="Computed from the full 500-point evaluation grid of each run">
          <CaseTable cases={cases} focusR={focus.R} onPick={setFocusR} />
        </Card>

        <footer className="foot">
          Data: <code>real-hardware-final/pinn_*.csv</code> (PINN simulation results), <code>com-complexity/</code>, <code>nl-kernel-results/</code>,{' '}
          <code>results/training_results.json</code>. Refresh with <code>npm run prepare-data</code>. Quantum-hardware results are not included.
        </footer>
      </main>
    </>
  );
}
