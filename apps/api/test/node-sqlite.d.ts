// Test-only surface for the Node built-in; no additional type/runtime package needed.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      all(...values: (string | number | null)[]): Record<string, string | number | null>[];
    };
    close(): void;
  }
}
