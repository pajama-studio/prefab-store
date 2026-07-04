import type { CoreComponents, KitPrefab } from "@pajama-studio/prefab-core/schema";

/** Domain-erased prefab (the single-root compatibility view over packages). */
export type AnyPrefab = KitPrefab<CoreComponents<never>>;
