/**
 * Represents the health of an entity.
 */
export type HealthData = {
  /** Current health points. */
  hp: number;
  /** Maximum health points. */
  maxHp: number;
};

/**
 * Component identifier for Health.
 */
export const Health = "health";
