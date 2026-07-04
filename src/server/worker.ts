import { validatePrefab } from "@pajama-studio/prefab-kit";
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
    const m = url.pathname.match(/^\/prefabs(?:\/([^/]+))?$/);
    if (!m) return json({ error: "not found" }, 404);
    const id = m[1] ? decodeURIComponent(m[1]) : undefined;

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,PUT,DELETE,OPTIONS",
        "access-control-allow-headers": "authorization,content-type",
      } });
    }

    if (req.method === "GET" && !id) {
      const rows = await env.DB.prepare("SELECT id, name, version FROM prefabs ORDER BY updated_at DESC").all();
      return json({ prefabs: rows.results ?? [] });
    }
    if (req.method === "GET" && id) {
      const row = await env.DB.prepare("SELECT data FROM prefabs WHERE id = ?").bind(id).first<{ data: string }>();
      if (!row) return json({ error: "not found" }, 404);
      return new Response(row.data, { headers: { "content-type": "application/json", "access-control-allow-origin": "*" } });
    }
    if (req.method === "PUT" && id) {
      if (!authed(req, env)) return json({ error: "unauthorized" }, 401);
      let prefab: AnyPrefab;
      try { prefab = (await req.json()) as AnyPrefab; } catch { return json({ error: "invalid JSON" }, 400); }
      if (prefab.id !== id) return json({ error: "id mismatch" }, 400);
      const problems = validatePrefab(prefab);
      if (problems.length) return json({ error: `invalid prefab: ${problems.join("; ")}` }, 422);
      await env.DB.prepare(
        "INSERT INTO prefabs (id, name, version, data, updated_at) VALUES (?, ?, ?, ?, datetime('now')) " +
        "ON CONFLICT(id) DO UPDATE SET name = excluded.name, version = excluded.version, data = excluded.data, updated_at = excluded.updated_at",
      ).bind(prefab.id, prefab.name, prefab.version ?? 1, JSON.stringify(prefab)).run();
      return json({ ok: true });
    }
    if (req.method === "DELETE" && id) {
      if (!authed(req, env)) return json({ error: "unauthorized" }, 401);
      await env.DB.prepare("DELETE FROM prefabs WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
    return json({ error: "method not allowed" }, 405);
  },
};
