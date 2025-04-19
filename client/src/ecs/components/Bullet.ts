/**
 * Data for the Bullet component.
 */
export type BulletData = {
  /** Damage dealt on collision. */
  damage: number;
  /** Time in seconds before the bullet despawns. */
  lifespan: number;
  /** The entity ID that fired this bullet (to avoid self-collision). */
  firedBy: number | string;
};

/**
 * Component identifier for Bullet.
 */
export const Bullet = "bullet";
