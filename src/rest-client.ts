import { prefabToPackage, type PrefabPackage, type PrefabStore, type PrefabStoreSaveOptions, type PrefabStoreSummary } from "@pajama-studio/prefab-core/schema";
import type { AnyPrefab } from "./types.js";

/** REST client for any server speaking the prefab-store protocol
 *  (the packaged Cloudflare D1 worker, or your own implementation):
 *
 *    GET    {base}/packages          → { packages: [{ id, name, version }] }
 *    GET    {base}/packages/:id      → the package JSON (404 → null)
 *    PUT    {base}/packages/:id      → save package (validates server-side)
 *    DELETE {base}/packages/:id
 *
 *  Compatibility:
 *    GET/PUT {base}/prefabs/:id      → root-prefab view over packages
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

  private visibilityQuery(opts: PrefabStoreSaveOptions = {}): string {
    return opts.visibility ? `?visibility=${encodeURIComponent(opts.visibility)}` : "";
  }

  async list(): Promise<PrefabStoreSummary[]> {
    const r = await this.f(`${this.base}/packages`, { headers: this.headers() });
    if (!r.ok) throw new Error(`prefab-store list failed: ${r.status}`);
    const d = (await r.json()) as { packages: PrefabStoreSummary[] };
    return d.packages;
  }

  async loadPackage(id: string): Promise<PrefabPackage | null> {
    const r = await this.f(`${this.base}/packages/${encodeURIComponent(id)}`, { headers: this.headers() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`prefab-store loadPackage failed: ${r.status}`);
    return (await r.json()) as PrefabPackage;
  }

  async savePackage(pkg: PrefabPackage, opts: PrefabStoreSaveOptions = {}): Promise<void> {
    const id = pkg.prefabs[0]?.id;
    if (!id) throw new Error("prefab-store savePackage failed: package has no root prefab");
    const r = await this.f(`${this.base}/packages/${encodeURIComponent(id)}${this.visibilityQuery(opts)}`, {
      method: "PUT",
      headers: this.headers(true),
      body: JSON.stringify(pkg),
    });
    if (!r.ok) throw new Error(`prefab-store savePackage failed: ${r.status} ${await r.text()}`);
  }

  async load(id: string): Promise<AnyPrefab | null> {
    const r = await this.f(`${this.base}/prefabs/${encodeURIComponent(id)}`, { headers: this.headers() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`prefab-store load failed: ${r.status}`);
    return (await r.json()) as AnyPrefab;
  }

  async save(prefab: AnyPrefab, opts?: PrefabStoreSaveOptions): Promise<void> {
    await this.savePackage(prefabToPackage(prefab), opts);
  }

  async remove(id: string): Promise<void> {
    const r = await this.f(`${this.base}/packages/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    if (!r.ok && r.status !== 404) throw new Error(`prefab-store remove failed: ${r.status}`);
  }
}
