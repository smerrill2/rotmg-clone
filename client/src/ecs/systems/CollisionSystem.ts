import { World } from "miniplex";
import { Entity, world } from "../world";
import { Collidable, type CollidableData } from "../components/Collidable";
import { Transform, type TransformData } from "../components/Transform";
import { Bullet, type BulletData } from "../components/Bullet";
import { Health, type HealthData } from "../components/Health";
import { BoundingBox } from "@babylonjs/core/Culling/boundingBox";
import { BulletSystem } from "./BulletSystem"; // Import BulletSystem to return bullets
import { BoundingInfo } from "@babylonjs/core/Culling/boundingInfo"; // Import BoundingInfo

/**
 * Handles collision detection and response between entities.
 */
export class CollisionSystem {
  // Class property queries using identifiers
  private collidables = world.with(Collidable, Transform);
  private bullets = world.with(Bullet, Collidable, Transform);

  private bulletSystem: BulletSystem;

  constructor(bulletSystem: BulletSystem) {
    this.bulletSystem = bulletSystem;
  }

  update(_dt: number) {
    // Get current entities from queries
    const collidableEntities = Array.from(this.collidables); 
    const bulletEntities = Array.from(this.bullets); 

    for (const bullet of bulletEntities) { 
      for (const other of collidableEntities) {
        // Skip self-collision or collision with the entity that fired the bullet
        if (bullet === other || bullet[Bullet].firedBy === other.id) continue;

        const bulletData = bullet[Bullet];
        const otherHealth = other[Health];

        if (!bulletData) continue;

        // Get BoundingInfo from components
        const bulletInfo = bullet[Collidable]?.boundingInfo;
        const otherInfo = other[Collidable]?.boundingInfo;

        // Check if both are valid BoundingInfo instances
        if (!(bulletInfo instanceof BoundingInfo) || !(otherInfo instanceof BoundingInfo)) {
          console.warn("[CollisionSystem] Invalid BoundingInfo involved in check:", { bulletId: bullet.id, bulletInfo, otherId: other.id, otherInfo });
          continue; // Skip this pair
        }

        // Use BoundingInfo.intersects method
        if (bulletInfo.intersects(otherInfo, false)) { // false = use AABB check (faster)
          // Collision detected!
          console.log(`Collision: Bullet ${bullet.id} hit ${other.id}`);

          // Apply damage if the other entity has health
          // Check for health component by accessing it directly
          if (otherHealth) { 
            // Component exists, apply damage
            otherHealth.hp -= bulletData.damage; 
            console.log(`${other.id} health: ${otherHealth.hp}/${otherHealth.maxHp}`);
            if (otherHealth.hp <= 0) {
              console.log(`${other.id} died!`);
            }
          } else {
             // This case should ideally not happen if world.has passed
             console.warn(`Entity ${other.id} passed world.has(Health) but Health component was undefined.`);
          }

          this.bulletSystem.returnBullet(bullet);
          break; 
        }
      }
    }
  }
} 