import type { PrefabStore } from "@pajama-studio/prefab-core/schema";
import type { AnyPrefab } from "./types.js";

/** REST client for any server speaking the prefab-store protocol
 *  (the packaged Cloudflare D1 worker, or your own implementation):
 *
 *    GET    {base}/prefabs          → { prefabs: [{ id, name, version }] }
 *    GET    {base}/prefabs/:id      → the prefab JSON (404 → null)
 *    PUT    {base}/prefabs/:id      → save (validates server-side)
 *    DELETE {base}/prefabs/:id
 *
 *  Auth is a bearer token (omit for open servers). */
export class RestPrefabStore implements PrefabStore {
  constructor(
    private base: string,
    private opts: { token?: string; fetchImpl?: typeof fetch } = {},
  ) {}

  private get f(): typeof fetch {
    return this.opts.fetchImpl ?? fetch;
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {};
    if (json) h["content-type"] = "application/json";
    if (this.opts.token) h["authorization"] = `Bearer ${this.opts.token}`;
    return h;
  }

  async list(): Promise<{ id: string; name: string; version: number }[]> {
    const r = await this.f(`${this.base}/prefabs`, { headers: this.headers() });
    if (!r.ok) throw new Error(`prefab-store list failed: ${r.status}`);
    const d = (await r.json()) as { prefabs: { id: string; name: string; version: number }[] };
    return d.prefabs;
  }

  async load(id: string): Promise<AnyPrefab | null> {
    const r = await this.f(`${this.base}/prefabs/${encodeURIComponent(id)}`, { headers: this.headers() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`prefab-store load failed: ${r.status}`);
    return (await r.json()) as AnyPrefab;
  }

  async save(prefab: AnyPrefab): Promise<void> {
    const r = await this.f(`${this.base}/prefabs/${encodeURIComponent(prefab.id)}`, {
      method: "PUT",
      headers: this.headers(true),
      body: JSON.stringify(prefab),
    });
    if (!r.ok) throw new Error(`prefab-store save failed: ${r.status} ${await r.text()}`);
  }

  async remove(id: string): Promise<void> {
    const r = await this.f(`${this.base}/prefabs/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!r.ok && r.status !== 404) throw new Error(`prefab-store remove failed: ${r.status}`);
  }
}
