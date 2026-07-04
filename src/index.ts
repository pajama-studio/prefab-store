/** @pajama-studio/prefab-store — generic prefab persistence.
 *  The package-aware PrefabStore protocol comes from prefab-core/schema
 *  (Memory/WebStorage included there); this package adds the REST client and
 *  ships an open-source Cloudflare D1 server (see ./server and
 *  server-template/). */
export { RestPrefabStore } from "./rest-client.js";
export type { PrefabPackage, PrefabStore, PrefabStoreSummary, PrefabVisibility } from "@pajama-studio/prefab-core/schema";
export type { AnyPrefab } from "./types.js";
