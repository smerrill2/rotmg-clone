import { Vector3 } from "@babylonjs/core";

/**
 * Type definition for the Transform component's data.
 */
export type TransformData = {
  pos: Vector3;
  // rotation?: Quaternion; // Add later if needed
  // scale?: Vector3;       // Add later if needed
};

/**
 * Component identifier for Transform.
 */
export const Transform = "transform";
