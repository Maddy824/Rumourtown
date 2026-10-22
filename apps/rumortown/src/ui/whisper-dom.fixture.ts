/** Small test DOM for sheet events; browser geometry is checked separately. */
export class TestElement extends EventTarget {
  children: TestElement[] = [];
  parent: TestElement | null = null;
  attrs = new Map<string, string>();
  dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  checked = false;
  private ownText = '';
  private ownValue: string | undefined;
  constructor(readonly tagName: string) { super(); }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
    if (name === 'hidden') this.hidden = true;
    if (name === 'disabled') this.disabled = true;
    if (name === 'checked') this.checked = true;
  }
  removeAttribute(name: string): void { this.attrs.delete(name); }
  getAttribute(name: string): string | null { return this.attrs.get(name) ?? null; }
  get textContent(): string { return this.ownText + this.children.map(c => c.textContent).join(''); }
  set textContent(value: string) { this.ownText = value; this.children = []; }
  get value(): string {
    return this.ownValue ?? this.attrs.get('value') ?? this.children.find(c => c.attrs.has('selected'))?.value ?? this.children[0]?.value ?? '';
  }
  set value(value: string) { this.ownValue = value; }
  appendChild(child: TestElement): TestElement { child.parent = this; this.children.push(child); return child; }
  replaceChildren(...children: TestElement[]): void { this.children = []; this.ownText = ''; children.forEach(c => this.appendChild(c)); }
  matches(selector: string): boolean {
    if (selector.includes(' ')) {
      const [parent, child] = selector.split(' ');
      return this.matches(child!) && Boolean(this.parent?.closest(parent!));
    }
    if (selector.startsWith('.')) return (this.attrs.get('class') ?? '').split(' ').includes(selector.slice(1));
    if (selector === 'input:checked') return this.tagName === 'input' && this.checked;
    return this.tagName === selector;
  }
  closest(selector: string): TestElement | null { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
  querySelectorAll<T = TestElement>(selector: string): T[] {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]) as T[];
  }
  querySelector<T = TestElement>(selector: string): T | null { return this.querySelectorAll<T>(selector)[0] ?? null; }
  focus(): void { /* Focus order and trapping need a real browser. */ }
  scrollIntoView(): void {}
}
export function sheetDocument(): Document {
  return {
    createElement: (tag: string) => new TestElement(tag),
    createElementNS: (_ns: string, tag: string) => new TestElement(tag),
    createTextNode: (text: string) => { const el = new TestElement('#text'); el.textContent = text; return el; },
  } as unknown as Document;
}
