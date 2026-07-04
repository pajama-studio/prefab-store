# @pajama-studio/prefab-store

Generic prefab persistence for the Pajama Studio prefab framework.

- **Protocol** — `PrefabStore` (list/load/save/remove) from
  `@pajama-studio/prefab-kit`; Memory/WebStorage backends ship there.
- **`RestPrefabStore`** — client for any server speaking the store protocol.
- **Open-source cloud store** — a zero-dependency Cloudflare Workers + D1
  server (`@pajama-studio/prefab-store/server`): bearer-token writes, public
  reads, server-side `validatePrefab`. Deploy in three commands:

```bash
cp -r node_modules/@pajama-studio/prefab-store/server-template my-store && cd my-store
wrangler d1 create prefab-store && wrangler d1 execute prefab-store --file schema.sql
wrangler deploy   # optional: wrangler secret put WRITE_TOKEN
```

```ts
import { RestPrefabStore } from "@pajama-studio/prefab-store";
const store = new RestPrefabStore("https://my-store.example.workers.dev", { token: "…" });
await store.save(myPrefab);
```
