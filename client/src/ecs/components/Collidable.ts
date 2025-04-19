import type { BoundingInfo } from "@babylonjs/core/Culling/boundingInfo";
import { BoundingBox } from "@babylonjs/core/Culling/boundingBox";

/**
 * Marks an entity as collidable and defines its bounding box data.
 */
export type CollidableData = {
  /** The BoundingInfo for collision detection. */
  boundingInfo: BoundingInfo;
  /** Bitmask for collision layers/groups (optional). */
  layer?: number;
  /** Bitmask for which layers this collidable interacts with (optional). */
  mask?: number;
};

/**
 * Component identifier for Collidable.
 */
export const Collidable = "collidable"; 