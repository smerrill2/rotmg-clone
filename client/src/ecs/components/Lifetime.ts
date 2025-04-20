import { Component } from "../../ecs/types";

/**
 * Stores the remaining lifetime (in milliseconds) for an entity.
 */
export type LifetimeData = {
  ms: number;
};

export const Lifetime = "lifetime"; 