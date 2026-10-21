/** Transient guidance expires even if the simulation is paused. */
export function createStatusLine(el: HTMLElement, clock = () => performance.now()) {
  let until = clock() + 6000;
  return {
    show(text: string) { el.textContent = text; el.hidden = false; until = clock() + 6000; },
    clear() { el.hidden = true; el.textContent = ''; until = -Infinity; },
    update(now: number) { if (now >= until) { el.hidden = true; el.textContent = ''; } },
  };
}
