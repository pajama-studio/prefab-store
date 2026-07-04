/** @pajama-studio/prefab-store — generic prefab persistence.
 *  The PrefabStore protocol comes from prefab-kit (Memory/WebStorage included
 *  there); this package adds the REST client and ships an open-source
 *  Cloudflare D1 server (see ./server and server-template/). */
export { RestPrefabStore } from "./rest-client.js";
export type { PrefabStore } from "@pajama-studio/prefab-core/schema";
export type { AnyPrefab } from "./types.js";
