import { describe, expect, it } from "vitest";
import { RestPrefabStore } from "./rest-client.js";
import worker, { type Env } from "./server/worker.js";
import type { AnyPrefab } from "./types.js";
import { PACKAGE_FORMAT, PACKAGE_VERSION, type PrefabPackage } from "@pajama-studio/prefab-core/schema";

/** Minimal in-memory D1 stub covering the worker's package statements. */
function fakeD1(): Env["DB"] {
  const rows = new Map<string, { id: string; name: string; version: number; package: string; updated_at: string; visibility: string }>();
  const stmt = (sql: string) => {
    let bound: unknown[] = [];
    const api = {
      bind: (...args: unknown[]) => { bound = args; return api; },
      first: async () => (sql.startsWith("SELECT package") ? rows.get(bound[0] as string) ?? null : null),
      all: async () => ({ results: [...rows.values()].map(({ id, name, version, updated_at, visibility }) => ({ id, name, version, updated_at, visibility })) }),
      run: async () => {
        if (sql.startsWith("INSERT")) {
          const [id, name, version, packageJson, visibility] = bound as [string, string, number, string, string];
          rows.set(id, { id, name, version, package: packageJson, updated_at: "now", visibility });
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
  entities: [{ id: "g", name: "Glass", assetRef: { id: "", slug: "", thumbnailUrl: null, modelUrl: "https://cdn.example.com/glass.glb" }, components: { transform: { position: { x: 0, y: 0, z: 0 }, rotationY: 0, scale: 1 } } }],
} as unknown as AnyPrefab;

const pkg: PrefabPackage = {
  format: PACKAGE_FORMAT,
  formatVersion: PACKAGE_VERSION,
  prefabs: [prefab],
  requirements: { packs: [{ id: "kitchen-kit", version: "0.0.0" }] },
};

function serverFetch(env: Env): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) =>
    worker.fetch(new Request(input instanceof Request ? input : String(input), init), env)) as typeof fetch;
}

describe("prefab-store: REST client ⇄ D1 reference server", () => {
  it("round-trips savePackage → list → loadPackage → remove", async () => {
    const env: Env = { DB: fakeD1() };
    const store = new RestPrefabStore("https://store.test", { fetchImpl: serverFetch(env) });
    await store.savePackage(pkg, { visibility: "public" });
    expect(await store.list()).toEqual([{ id: "glass", name: "Glass", version: 1, updatedAt: "now", visibility: "public" }]);
    const loaded = await store.loadPackage("glass");
    expect(loaded?.prefabs[0].rootId).toBe("g");
    expect(loaded?.requirements?.packs?.[0]).toEqual({ id: "kitchen-kit", version: "0.0.0" });
    expect(loaded?.assets?.[0]).toMatchObject({ entityId: "g", field: "assetRef.modelUrl", kind: "external" });
    await store.remove("glass");
    expect(await store.loadPackage("glass")).toBeNull();
  });

  it("keeps single-prefab save/load as compatibility helpers", async () => {
    const env: Env = { DB: fakeD1() };
    const store = new RestPrefabStore("https://store.test", { fetchImpl: serverFetch(env) });
    await store.save(prefab);
    expect((await store.load("glass"))?.rootId).toBe("g");
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

  it("rejects unsafe external asset URLs (422)", async () => {
    const env: Env = { DB: fakeD1() };
    const store = new RestPrefabStore("https://store.test", { fetchImpl: serverFetch(env) });
    await expect(store.savePackage({
      ...pkg,
      prefabs: [{ ...prefab, assetRef: undefined, entities: [{ ...prefab.entities[0], assetRef: { ...prefab.entities[0].assetRef, modelUrl: "http://cdn.example.com/glass.glb" } }] } as unknown as AnyPrefab],
    })).rejects.toThrow(/422|invalid/);
  });
});
