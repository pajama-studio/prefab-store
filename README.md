# @pajama-studio/prefab-store

Generic prefab persistence for the Pajama Studio prefab framework.

- **Protocol** — package-aware `PrefabStore` from
  `@pajama-studio/prefab-core/schema`; Memory/WebStorage backends ship there.
- **`RestPrefabStore`** — client for any server speaking the store protocol.
- **Open-source cloud store** — a zero-dependency Cloudflare Workers + D1
  server (`@pajama-studio/prefab-store/server`): bearer-token writes, public
  reads, server-side package + asset-reference validation. Deploy in three
  commands:

```bash
cp -r node_modules/@pajama-studio/prefab-store/server-template my-store && cd my-store
wrangler d1 create prefab-store && wrangler d1 execute prefab-store --file schema.sql
wrangler deploy   # optional: wrangler secret put WRITE_TOKEN
```

```ts
import { RestPrefabStore } from "@pajama-studio/prefab-store";
const store = new RestPrefabStore("https://my-store.example.workers.dev", { token: "…" });
await store.savePackage(myPrefabPackage, { visibility: "public" });

// Compatibility helpers still work for single-root editors.
await store.save(myPrefab);
const root = await store.load(myPrefab.id);
```

Packages are self-contained declarations. They carry prefab dependencies,
declarative behavior data, asset-reference manifests, and required pack ids, but
not arbitrary executable code or binary asset payloads.

## REST shape

- `GET /packages` -> `{ packages: [{ id, name, version, updatedAt, visibility }] }`
- `GET /packages/:id` -> `PrefabPackage`
- `PUT /packages/:id` -> save a full `PrefabPackage`
- `DELETE /packages/:id`
- `GET /prefabs/:id` -> compatibility root-prefab view
- `PUT /prefabs/:id` -> compatibility single-prefab save
