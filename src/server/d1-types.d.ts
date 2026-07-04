/** Minimal structural typing for the D1 binding — avoids a hard dependency
 *  on @cloudflare/workers-types (bring your own for full typing). */
interface D1Database {
  prepare(sql: string): {
    bind(...args: unknown[]): ReturnType<D1Database["prepare"]>;
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<{ results?: T[] }>;
    run(): Promise<unknown>;
  };
}
