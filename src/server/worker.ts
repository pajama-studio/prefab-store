import {
  PACKAGE_FORMAT,
  normalizePrefabPackageForSave,
  prefabToPackage,
  type PrefabPackage,
  type PrefabVisibility,
} from "@pajama-studio/prefab-core/schema";
import type { AnyPrefab } from "../types.js";

/** Open-source prefab-store server for Cloudflare Workers + D1.
 *
 *  Deploy: copy server-template/ (wrangler.toml + schema.sql), then
 *    wrangler d1 create prefab-store && wrangler d1 execute … --file schema.sql
 *    wrangler deploy
 *
 *  Auth: set the WRITE_TOKEN secret to require `Authorization: Bearer …` on
 *  writes (reads stay public); leave it unset for a fully open store. */
export interface Env {
  DB: D1Database;
  WRITE_TOKEN?: string;
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });

function authed(req: Request, env: Env): boolean {
  if (!env.WRITE_TOKEN) return true;
  return req.headers.get("authorization") === `Bearer ${env.WRITE_TOKEN}`;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/(packages|prefabs)(?:\/([^/]+))?$/);
    if (!m) return json({ error: "not found" }, 404);
    const resource = m[1] as "packages" | "prefabs";
    const id = m[2] ? decodeURIComponent(m[2]) : undefined;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,PUT,DELETE,OPTIONS",
        "access-control-allow-headers": "authorization,content-type",
      } });
    }

    if (req.method === "GET" && !id) {
      const rows = await env.DB.prepare("SELECT id, name, version, updated_at, visibility FROM prefab_packages ORDER BY updated_at DESC").all();
      const packages = (rows.results ?? []).map((row) => {
        const r = row as { id: string; name: string; version: number; updated_at: string; visibility: PrefabVisibility };
        return { id: r.id, name: r.name, version: r.version, updatedAt: r.updated_at, visibility: r.visibility };
      });
      return json(resource === "packages" ? { packages } : { prefabs: packages });
    }
    if (req.method === "GET" && id) {
      const row = await env.DB.prepare("SELECT package FROM prefab_packages WHERE id = ?").bind(id).first<{ package: string }>();
      if (!row) return json({ error: "not found" }, 404);
      if (resource === "packages") {
        return new Response(row.package, { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
      }
      const pkg = JSON.parse(row.package) as PrefabPackage;
      return json(pkg.prefabs[0]);
    }
    if (req.method === "PUT" && id) {
      if (!authed(req, env)) return json({ error: "unauthorized" }, 401);
      let pkg: PrefabPackage;
      try {
        const body = await req.json();
        pkg = resource === "packages" || (body as Partial<PrefabPackage>)?.format === PACKAGE_FORMAT
          ? normalizePrefabPackageForSave(body as PrefabPackage)
          : normalizePrefabPackageForSave(prefabToPackage(body as AnyPrefab));
      } catch (e) {
        const message = e instanceof Error ? e.message : "invalid JSON";
        return json({ error: message }, message === "invalid JSON" ? 400 : 422);
      }
      const root = pkg.prefabs[0];
      if (root.id !== id) return json({ error: "id mismatch" }, 400);
      const visibility = url.searchParams.get("visibility") === "public" ? "public" : "private";
      await env.DB.prepare(
        "INSERT INTO prefab_packages (id, name, version, package, visibility, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now')) " +
        "ON CONFLICT(id) DO UPDATE SET name = excluded.name, version = excluded.version, package = excluded.package, visibility = excluded.visibility, updated_at = excluded.updated_at",
      ).bind(root.id, root.name, root.version ?? 1, JSON.stringify(pkg), visibility).run();
      return json({ ok: true });
    }
    if (req.method === "DELETE" && id) {
      if (!authed(req, env)) return json({ error: "unauthorized" }, 401);
      await env.DB.prepare("DELETE FROM prefab_packages WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
    return json({ error: "method not allowed" }, 405);
  },
};
