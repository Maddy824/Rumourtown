# 05: Benchmarks

Status: DONE. `npm run bench` runs `node --experimental-strip-types bench/sim.ts` without new dependencies. A one-time Vite bundle resolves the source's .js-to-.ts imports; compilation/setup is outside measured loops. The actual map/cast/talk/world/engine are used for 2,700 ticks each with 24 and 60 villagers, unique background IDs and shifted schedules. Seeded A* sampling measures 1,000 reachable pairs; 100,000 hears are measured with a ledger reset every 100 calls to bound memory growth.

Apple M4 Max, macOS arm64, Node 25.8.2, 21 October 2026: real-cast median/p95 tick 0.1445/0.4775 ms, 5,255 game-minutes/sec; 60-person synthetic median/p95 0.8818/17.5565 ms, 267 game-minutes/sec. The stress-case tail is reported rather than treating it as shipped-phone evidence. Full table and methodology in `bench/results.md`, copied into README. No performance claim about physical phones or Safari is made.
