# Benchmarks

Measured 21 October 2026 on Apple M4 Max, darwin arm64, Node v25.8.2. Seed 731.

| Workload | Median per operation | p95 per operation | Total measured time | Game-minutes/second |
|---|---:|---:|---:|---:|
| Simulation, 24 villagers (2,700 ticks) | 0.1445 ms | 0.4775 ms | 513.8 ms | 5255 |
| Simulation, 60 villagers (2,700 ticks) | 0.8818 ms | 17.5565 ms | 10102.6 ms | 267 |
| A*, 1,000 reachable pairs | 0.0067 ms | 0.0322 ms | 10.5 ms | — |
| BeliefLedger.hear, 100,000 calls | 0.0002 ms | 0.0004 ms | 20.3 ms | — |

Simulation rows run the real map, authored talk, cast and engine for three full days with one opening whisper. The 60-person cast duplicates background villagers with unique IDs and shifted schedules. Bundle compilation and simulation setup are excluded; setup time is printed to stderr. A* totals include successful pairs only. Hearings reset the ledger every 100 calls; timing overhead is included and tiny measurements should be read as approximate. These are desktop CPU measurements, not phone rendering or Safari results. Run `npm run bench` to reproduce.
