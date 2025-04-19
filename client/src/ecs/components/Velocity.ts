import { Vector3 } from "@babylonjs/core/Maths/math.vector";

/**
 * Represents the velocity of an entity.
 * Stores velocity as a Vector3 for 3D movement capability,
 * although current movement might be constrained to the XZ plane.
 */
export const Velocity = "velocity"; // Component identifier
export type VelocityData = {
  /** The velocity vector. */
  vel: Vector3;
};
