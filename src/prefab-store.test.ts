import { describe, expect, it } from "vitest";
import { RestPrefabStore } from "./rest-client.js";
import worker, { type Env } from "./server/worker.js";
import type { AnyPrefab } from "./types.js";

/** Minimal in-memory D1 stub covering the worker's three statements. */
function fakeD1(): Env["DB"] {
  const rows = new Map<string, { id: string; name: string; version: number; data: string; updated_at: string }>();
  const stmt = (sql: string) => {
    let bound: unknown[] = [];
    const api = {
      bind: (...args: unknown[]) => { bound = args; return api; },
      first: async () => (sql.startsWith("SELECT data") ? rows.get(bound[0] as string) ?? null : null),
      all: async () => ({ results: [...rows.values()].map(({ id, name, version }) => ({ id, name, version })) }),
      run: async () => {
        if (sql.startsWith("INSERT")) {
          const [id, name, version, data] = bound as [string, string, number, string];
          rows.set(id, { id, name, version, data, updated_at: "now" });
        } else if (sql.startsWith("DELETE")) rows.delete(bound[0] as string);
        return {};
      },
    };
    return api;
  };
  return { prepare: stmt } as unknown as Env["DB"];
}

const prefab: AnyPrefab = {
  id: "glass", name: "Glass", version: 1, rootId: "g",
  entities: [{ id: "g", name: "Glass", assetRef: { id: "", slug: "", thumbnailUrl: null, modelUrl: null }, components: { transform: { position: { x: 0, y: 0, z: 0 }, rotationY: 0, scale: 1 } } }],
} as unknown as AnyPrefab;

function serverFetch(env: Env): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    worker.fetch(new Request(input instanceof Request ? input : String(input), init), env)) as typeof fetch;
}

describe("prefab-store: REST client ⇄ D1 reference server", () => {
  it("round-trips save → list → load → remove", async () => {
    const env: Env = { DB: fakeD1() };
    const store = new RestPrefabStore("https://store.test", { fetchImpl: serverFetch(env) });
    await store.save(prefab);
    expect(await store.list()).toEqual([{ id: "glass", name: "Glass", version: 1 }]);
    const loaded = await store.load("glass");
    expect(loaded?.rootId).toBe("g");
    await store.remove("glass");
    expect(await store.load("glass")).toBeNull();
  });

  it("enforces the write token when configured", async () => {
    const env: Env = { DB: fakeD1(), WRITE_TOKEN: "s3cret" };
    const anon = new RestPrefabStore("https://store.test", { fetchImpl: serverFetch(env) });
    await expect(anon.save(prefab)).rejects.toThrow(/401/);
    const authed = new RestPrefabStore("https://store.test", { token: "s3cret", fetchImpl: serverFetch(env) });
    await authed.save(prefab);
    expect((await authed.list()).length).toBe(1);
    // reads stay public
    expect(await anon.load("glass")).not.toBeNull();
  });

  it("rejects structurally invalid prefabs (422)", async () => {
    const env: Env = { DB: fakeD1() };
    const store = new RestPrefabStore("https://store.test", { fetchImpl: serverFetch(env) });
    const bad = { ...prefab, id: "bad", rootId: "missing-entity" } as AnyPrefab;
    await expect(store.save(bad)).rejects.toThrow(/422|invalid/);
  });
});
