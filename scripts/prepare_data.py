"""Export research results into compact JSON for the dashboard.

Usage: python3 -I scripts/prepare_data.py [path/to/markovian-pinn]
Hardware / quantum-circuit results are intentionally NOT exported.
"""
import csv, json, math, os, sys
from collections import defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/Projects/PINN/markovian-pinn')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data')
os.makedirs(OUT, exist_ok=True)

def r(x, d=5): return float(f'{float(x):.{d}g}')
def F(c): return (1 + c) ** 2 / 4
def rms(a): return math.sqrt(sum(x * x for x in a) / len(a))
def grid(R):  # paper sweep settings (cases list in paper_revision_*.ipynb)
    if R < 0.45: return 15000, 150, 300
    if R < 0.55: return 20000, 200, 400
    if R < 4.5: return 25000, 250, 500
    return 30000, 300, 600
def regime(R):
    return 'weak' if R < 0.5 else 'strong'

# ---- forward sweep: full-resolution metrics, error map, downsampled curves ----
rows = defaultdict(list)
for row in csv.DictReader(open(os.path.join(SRC, 'real-hardware-final/pinn_simulation_results.csv'))):
    rows[float(row['R'])].append(row)
hist = defaultdict(list)
for row in csv.DictReader(open(os.path.join(SRC, 'real-hardware-final/pinn_training_history.csv'))):
    hist[float(row['R'])].append((int(row['epoch']), float(row['loss']), float(row['max_residual'])))

BINS = 60
cases = []
for R in sorted(rows):
    rs = rows[R]
    t = [float(x['t']) for x in rs]; ex = [float(x['exact_c1']) for x in rs]
    ode = [float(x['ode_c1']) for x in rs]; pn = [float(x['pinn_c1']) for x in rs]
    dc = [p - e for p, e in zip(pn, ex)]; dF = [F(p) - F(e) for p, e in zip(pn, ex)]
    tmax = t[-1]
    emap = [0.0] * BINS
    for ti, d in zip(t, dc):
        b = min(BINS - 1, int(ti / tmax * BINS)); emap[b] = max(emap[b], abs(d))
    h = hist[R]
    first = lambda thr: next((e for e, l, _ in h if l < thr), None)
    n = len(h); idx = sorted({min(n - 1, int(round(math.exp(i * math.log(n) / 140))) - 1) for i in range(141)})
    ep, nc, nq = grid(R)
    keep = list(range(0, len(t), 4)) + ([len(t) - 1] if (len(t) - 1) % 4 else [])
    cases.append({
        'R': R, 'label': rs[0]['label'], 'regime': regime(R), 'tmax': r(tmax), 'epochs': ep, 'nc': nc, 'nq': nq,
        'maxC': r(max(map(abs, dc))), 'rmseC': r(rms(dc)), 'maxF': r(max(map(abs, dF))), 'rmseF': r(rms(dF)),
        'odeMax': r(max(abs(o - e) for o, e in zip(ode, ex))),
        'finalLoss': r(h[-1][1]), 'minLoss': r(min(l for _, l, _ in h)), 'finalRes': r(h[-1][2]),
        'ep1e5': first(1e-5), 'ep1e6': first(1e-6),
        'emap': [r(v, 3) for v in emap],
        'curve': {'t': [r(t[i]) for i in keep], 'exact': [r(ex[i], 6) for i in keep], 'ode': [r(ode[i], 6) for i in keep], 'pinn': [r(pn[i], 6) for i in keep]},
        'hist': {'epoch': [h[i][0] for i in idx], 'loss': [r(h[i][1], 4) for i in idx], 'res': [r(h[i][2], 4) for i in idx]},
    })

# ---- multi-seed robustness ----
seeds = defaultdict(list)
for row in csv.DictReader(open(os.path.join(SRC, 'com-complexity/pinn_multiseed_per_seed.csv'))):
    seeds[float(row['R'])].append({'seed': int(row['seed']), 'maxC': r(row['maxabs_c1']), 'rmseC': r(row['rmse_c1']),
                                   'maxF': r(row['maxabs_F']), 'rmseF': r(row['rmse_F']), 'loss': r(row['final_loss'])})
stats = {float(row['R']): row for row in csv.DictReader(open(os.path.join(SRC, 'com-complexity/pinn_multiseed_error_stats.csv')))}
seed_out = [{'R': R, 'regime': stats[R]['regime'], 'runs': seeds[R],
             'mean': {k: r(stats[R][f'{c}_mean']) for k, c in (('maxC', 'maxabs_c1'), ('rmseC', 'rmse_c1'), ('maxF', 'maxabs_F'), ('rmseF', 'rmse_F'))},
             'std': {k: r(stats[R][f'{c}_std']) for k, c in (('maxC', 'maxabs_c1'), ('rmseC', 'rmse_c1'), ('maxF', 'maxabs_F'), ('rmseF', 'rmse_F'))}}
            for R in sorted(seeds)]

# ---- Gaussian kernel ----
g = defaultdict(list)
for row in csv.DictReader(open(os.path.join(SRC, 'nl-kernel-results/gaussian_kernel_results.csv'))):
    g[float(row['R'])].append(row)
gauss = []
for R in sorted(g):
    rs = g[R]; ref = [float(x['gauss_ref_c1']) for x in rs]; pn = [float(x['gauss_pinn_c1']) for x in rs]
    dc = [p - e for p, e in zip(pn, ref)]; dF = [F(p) - F(e) for p, e in zip(pn, ref)]
    keep = list(range(0, len(rs), 4)) + ([len(rs) - 1] if (len(rs) - 1) % 4 else [])
    gauss.append({'R': R, 'label': rs[0]['label'], 'maxC': r(max(map(abs, dc))), 'rmseC': r(rms(dc)), 'maxF': r(max(map(abs, dF))), 'rmseF': r(rms(dF)),
                  'curve': {'t': [r(rs[i]['t']) for i in keep], 'ref': [r(ref[i], 6) for i in keep], 'pinn': [r(pn[i], 6) for i in keep]}})

cost = list(csv.DictReader(open(os.path.join(SRC, 'com-complexity/computational_cost.csv'))))
tr = json.load(open(os.path.join(SRC, 'results/training_results.json')))
markov = {k: tr[k] for k in ('architecture', 'n_params', 'optimizer', 'n_iterations', 'final_loss', 'final_loss_components', 'validation', 'training_time_seconds')}
markov['log'] = [{k: v for k, v in e.items() if k != 'time'} for e in tr['training_log']]

out = {'cases': cases, 'seeds': seed_out, 'gaussian': gauss, 'cost': cost, 'markovian': markov}
p = os.path.join(OUT, 'results.json')
json.dump(out, open(p, 'w'), separators=(',', ':'))
print(f'results.json: {os.path.getsize(p)/1024:.1f} KB')
for c in cases: print(c['R'], c['maxC'], c['rmseC'], c['ep1e5'], c['finalLoss'])
for x in gauss: print('gauss', x['R'], x['maxC'], x['maxF'])
