/**
 * The stack of open sheets, drawers and cards. Escape closes the top one; modal layers keep Tab inside;
 * closing returns focus to whatever opened the layer.
 */
import { focusables } from './dom.js';

export interface Layer {
  id: string;
  el: HTMLElement;
  modal: boolean;
  close: () => void;
}

export interface Layers {
  open(layer: Layer, opener?: Element | null): void;
  /** Forget a layer that has closed itself; restores focus if it held it. */
  closed(id: string): void;
  top(): Layer | undefined;
  isOpen(id: string): boolean;
  anyModal(): boolean;
}

export function createLayers(): Layers {
  const stack: { layer: Layer; opener: Element | null }[] = [];

  const onKey = (ev: KeyboardEvent): void => {
    const top = stack[stack.length - 1];
    if (!top) return;
    if (ev.key === 'Escape') {
      ev.preventDefault();
      top.layer.close();
      return;
    }
    if (ev.key === 'Tab' && top.layer.modal) {
      const items = focusables(top.layer.el);
      if (items.length === 0) {
        ev.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!top.layer.el.contains(active)) {
        ev.preventDefault();
        first?.focus();
      } else if (ev.shiftKey && active === first) {
        ev.preventDefault();
        last?.focus();
      } else if (!ev.shiftKey && active === last) {
        ev.preventDefault();
        first?.focus();
      }
    }
  };
  document.addEventListener('keydown', onKey);

  return {
    open(layer, opener) {
      const existing = stack.findIndex((s) => s.layer.id === layer.id);
      if (existing >= 0) stack.splice(existing, 1);
      stack.push({ layer, opener: opener ?? document.activeElement });
    },
    closed(id) {
      const i = stack.findIndex((s) => s.layer.id === id);
      if (i < 0) return;
      const [entry] = stack.splice(i, 1);
      if (!entry) return;
      const active = document.activeElement;
      const hadFocus = !active || active === document.body || entry.layer.el.contains(active);
      if (hadFocus && entry.opener instanceof HTMLElement && entry.opener.isConnected) {
        entry.opener.focus({ preventScroll: true });
      }
    },
    top: () => stack[stack.length - 1]?.layer,
    isOpen: (id) => stack.some((s) => s.layer.id === id),
    anyModal: () => stack.some((s) => s.layer.modal),
  };
}
