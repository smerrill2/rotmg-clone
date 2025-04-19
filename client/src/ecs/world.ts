import { World } from "miniplex";
// Import component type definitions
import { type TransformData } from "./components/Transform";
import { type VelocityData } from "./components/Velocity";
import { type SpriteRefData } from "./components/SpriteRef";
import { type HealthData } from "./components/Health";
import { type CollidableData } from "./components/Collidable";
import { type BulletData } from "./components/Bullet";
import { type Player } from "./components/Player";

// Define a type for our entities, including known component structures
// Components are optional because not all entities have all components.
export type Entity = {
  id?: string | number;

  // Core components
  transform?: TransformData; 
  velocity?: VelocityData;
  spriteRef?: SpriteRefData;
  health?: HealthData;
  collidable?: CollidableData;
  
  // Role/State tags/components
  player?: boolean;
  bullet?: BulletData;

  // Add other components here as needed
}

// Expose a single global world instance using the built-in World
// Specify the enhanced Entity type for better type safety
export const world = new World<Entity>();

// Systems will be managed and called manually in main.ts 