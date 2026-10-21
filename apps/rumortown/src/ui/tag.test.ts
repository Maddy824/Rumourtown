import { describe, expect, it, vi } from 'vitest';
import { replaceTagBody } from './tag.js';

// Small DOM doubles exercise focus ownership and identity without a browser or DOM dependency.
function fixture(oldKey: string, newKeys: string[], focusInside = true) {
  const control = (key: string) => ({ getAttribute: () => key, focus: vi.fn() });
  const old = control(oldKey);
  const replacements = newKeys.map(control);
  const fallback = { focus: vi.fn() };
  const body = {
    ownerDocument: { activeElement: old },
    contains: (element: unknown) => focusInside && element === old,
    replaceChildren: vi.fn(),
    querySelectorAll: () => replacements,
  };
  replaceTagBody(body as unknown as HTMLElement, [], fallback as unknown as HTMLElement);
  return { body, fallback, replacements };
}

describe('tag refresh focus', () => {
  it('follows a relation control through a changed ranking', () => {
    const { body, fallback, replacements } = fixture('relation:ben', ['relation:rosa', 'relation:ben']);
    expect(body.replaceChildren).toHaveBeenCalled();
    expect(replacements[1]!.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(fallback.focus).not.toHaveBeenCalled();
  });

  it('restores the Show all / Show fewer toggle and brings it into view', () => {
    const { replacements } = fixture('relations-toggle', ['relation:ben', 'relations-toggle']);
    expect(replacements[1]!.focus).toHaveBeenCalledWith({ preventScroll: false });
  });

  it('restores a chain face by its belief, link and actor identity', () => {
    const { replacements } = fixture('chain:theft:1:to:ben', ['chain:theft:1:to:ben']);
    expect(replacements[0]!.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('moves focus to the persistent heading when the focused control disappears', () => {
    const { fallback, replacements } = fixture('relation:ben', ['relation:rosa']);
    expect(fallback.focus).toHaveBeenCalledWith({ preventScroll: false });
    expect(replacements[0]!.focus).not.toHaveBeenCalled();
  });

  it('leaves focus outside the refreshed body alone', () => {
    const { fallback, replacements } = fixture('relation:ben', ['relation:ben'], false);
    expect(fallback.focus).not.toHaveBeenCalled();
    expect(replacements[0]!.focus).not.toHaveBeenCalled();
  });
});
