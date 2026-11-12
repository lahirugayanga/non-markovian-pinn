# PINN Results Dashboard

Interactive dashboard of the integro-differential PINN results from `~/Projects/PINN/markovian-pinn`
(forward R-sweep, 10-seed robustness, Gaussian kernel, cost, Markovian baseline).
Quantum-hardware results are intentionally excluded. Separate from the tutorial in `../tutorial`.

```bash
npm install
npm run dev            # http://localhost:5173 (also on your LAN, so you can open it on a phone)
npm run build          # static site in dist/
npm run prepare-data   # recompute src/data/results.json from the research project's CSV/JSON files
```

- Filters (focus R, regime, metric) scope every panel; selections persist in localStorage.
- Click a point (accuracy chart), a row (error map, seed strip, tables) to focus a coupling ratio.
- Metrics are computed from the full 500-point evaluation grid; "Download CSV" exports the case table.
