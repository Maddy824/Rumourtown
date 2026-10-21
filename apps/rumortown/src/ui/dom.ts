/**
 * Tiny DOM helpers. Strings always become text nodes, so nothing from the simulation is ever parsed as HTML.
 */
export type Child = Node | string | number | null | undefined | false | Child[];
type Handler = (ev: never) => void;
export type Attrs = Record<string, string | number | boolean | null | undefined | Handler>;

const SVG_NS = 'http://www.w3.org/2000/svg';

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) applyAttrs(el, attrs);
  append(el, children);
  return el;
}

export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) applyAttrs(el, attrs);
  append(el, children);
  return el;
}

function applyAttrs(el: Element, attrs: Attrs): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') {
      el.addEventListener(key.replace(/^on/, '').toLowerCase(), value as unknown as EventListener);
    } else if (value !== null && value !== undefined && value !== false) {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
}

export function append(el: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else if (typeof child === 'string' || typeof child === 'number') el.appendChild(document.createTextNode(String(child)));
    else el.appendChild(child);
  }
}

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusables(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest('[hidden]') && el.getClientRects().length > 0);
}

/** Show an element that animates in through `data-open`. */
export function reveal(el: HTMLElement): void {
  el.hidden = false;
  // Force a style flush so the transition runs from the closed state.
  void el.offsetWidth;
  el.dataset.open = 'true';
}

/** Hide an element after its closing transition (or at once when motion is reduced). */
export function conceal(el: HTMLElement, reducedMotion: boolean, done?: () => void): void {
  delete el.dataset.open;
  if (reducedMotion) {
    el.hidden = true;
    done?.();
    return;
  }
  const finish = (): void => {
    if (el.dataset.open) return;
    el.hidden = true;
    done?.();
  };
  window.setTimeout(finish, 200);
}

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
