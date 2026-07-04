import type { CoreComponents, KitPrefab } from "@pajama-studio/prefab-core/schema";

/** Domain-erased prefab (mirrors prefab-kit's store contract). */
export type AnyPrefab = KitPrefab<CoreComponents<never>>;
