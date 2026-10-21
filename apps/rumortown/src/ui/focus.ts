/** Presentation state only. Player input suspends camera following until an explicit resume. */
export function createRumorFocus() {
  let on = false, paused = false, until = 0;
  let people: readonly string[] = [];
  const queue: (readonly string[])[] = [];
  return {
    get on() { return on; }, get paused() { return paused; },
    toggle(next = !on) { on = next; paused = false; until = 0; people = []; queue.length = 0; },
    move() { if (on) { paused = true; until = 0; queue.length = 0; } },
    resume() { paused = false; until = 0; people = []; queue.length = 0; },
    transmission(ids: readonly string[], now: number) {
      if (!on || paused) return;
      if (now < until || queue.length) queue.push(ids);
      else { people = ids; until = now + 2000; }
    },
    target(now: number): readonly string[] {
      if (!on || paused) return [];
      if (now >= until && queue.length) { people = queue.shift()!; until = now + 2000; }
      return people;
    },
  };
}
export function createHint(start: number) {
  let dismissed = false;
  return { dismiss() { dismissed = true; }, visible(now: number) { if (now - start >= 20_000) dismissed = true; return !dismissed; } };
}
