# Benchmarks

Measured 21 October 2026 on Apple M4 Max, darwin arm64, Node v25.8.2. Seed 731.

| Workload | Median per operation | p95 per operation | Total measured time | Game-minutes/second |
|---|---:|---:|---:|---:|
| Simulation, 24 villagers (2,700 ticks) | 0.1531 ms | 0.4688 ms | 526.8 ms | 5126 |
| Simulation, 60 villagers (2,700 ticks) | 2.0292 ms | 24.8933 ms | 17355.9 ms | 156 |
| A*, 1,000 reachable pairs | 0.0065 ms | 0.0315 ms | 10.2 ms | — |
| BeliefLedger.hear, 100,000 calls | 0.0002 ms | 0.0005 ms | 29.2 ms | — |

Simulation rows run the real map, authored talk, cast and engine for three full days with one opening whisper. The 60-person cast duplicates background villagers with unique IDs and shifted schedules. Bundle compilation and simulation setup are excluded; setup time is printed to stderr. A* totals include successful pairs only. Hearings reset the ledger every 100 calls; timing overhead is included and tiny measurements should be read as approximate. These are desktop CPU measurements, not phone rendering or Safari results. Run `npm run bench` to reproduce.
