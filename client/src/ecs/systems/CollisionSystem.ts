import { World } from "miniplex";
import { Entity, world } from "../world";
import { Collidable, type CollidableData } from "../components/Collidable";
import { Transform, type TransformData } from "../components/Transform";
import { Bullet, type BulletData } from "../components/Bullet";
import { Health, type HealthData } from "../components/Health";
import { BoundingBox } from "@babylonjs/core/Culling/boundingBox";
import { BulletSystem } from "./BulletSystem"; // Import BulletSystem to return bullets
import { BoundingInfo } from "@babylonjs/core/Culling/boundingInfo"; // Import BoundingInfo
import { ParticleSystem } from "./ParticleSystem"; // CURSOR: Add import
import { Color4, Vector3 } from "@babylonjs/core"; // CURSOR: Add import

/**
 * Handles collision detection and response between entities.
 */
export class CollisionSystem {
  // Class property queries using identifiers
  private collidables = world.with(Collidable, Transform);
  private bullets = world.with(Bullet, Collidable, Transform);

  private bulletSystem: BulletSystem;
  private particleSystem: ParticleSystem; // CURSOR: Add private property
  private debugMode: boolean = false; // Debug flag

  constructor(bulletSystem: BulletSystem, particleSystem: ParticleSystem) { // CURSOR: Modify constructor signature
    this.bulletSystem = bulletSystem;
    this.particleSystem = particleSystem; // CURSOR: Inside constructor, store the instance
  }

  // Method to toggle debug mode
  public toggleDebug(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`[CollisionSystem] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  update(_dt: number) {
    // Get current entities from queries
    const collidableEntities = Array.from(this.collidables); 
    const bulletEntities = Array.from(this.bullets); 
    
    // Reduced logging - just report counts
    if (bulletEntities.length > 0) {
      console.log(`[CollisionSystem] Checking: ${bulletEntities.length} bullets, ${collidableEntities.length} collidables`);
    }

    for (const bullet of bulletEntities) { 
      for (const other of collidableEntities) {
        // Skip self-collision or collision with the entity that fired the bullet
        if (bullet === other || bullet[Bullet].firedBy === other.id) continue;

        const bulletData = bullet[Bullet];
        const otherHealth = other[Health];
        const bulletTransform = bullet[Transform];
        const otherTransform = other[Transform];

        // Enhanced check to ensure transforms and POSITIONS exist
        if (!bulletData || !bulletTransform || !bulletTransform.pos || !otherTransform || !otherTransform.pos) {
          if (this.debugMode) {
            // More detailed debug log
            console.warn(`[CollisionSystem] Skipping check due to missing data: bullet=${bullet.id}, other=${other.id}`, {
                hasBulletData: !!bulletData,
                hasBulletTransform: !!bulletTransform,
                hasBulletPos: !!bulletTransform?.pos,
                hasOtherTransform: !!otherTransform,
                hasOtherPos: !!otherTransform?.pos
            });
          }
          continue;
        }

        // Get BoundingInfo from components
        const bulletInfo = bullet[Collidable]?.boundingInfo;
        const otherInfo = other[Collidable]?.boundingInfo;

        // Check if both are valid BoundingInfo instances
        if (!(bulletInfo instanceof BoundingInfo) || !(otherInfo instanceof BoundingInfo)) {
          console.warn(`[CollisionSystem] Invalid BoundingInfo: bullet=${bullet.id}, other=${other.id}`);
          continue;
        }

        // Log position info in debug mode
        if (this.debugMode) {
          console.log(`[CollisionSystem] Checking: Bullet ${bullet.id} vs ${other.id}`);
          console.log(`[CollisionSystem] Positions: Bullet=(${bulletTransform.pos.x.toFixed(1)},${bulletTransform.pos.y.toFixed(1)},${bulletTransform.pos.z.toFixed(1)}), Other=(${otherTransform.pos.x.toFixed(1)},${otherTransform.pos.y.toFixed(1)},${otherTransform.pos.z.toFixed(1)})`);
        }

        // Use BoundingInfo.intersects method and log only when intersection occurs
        const isIntersecting = bulletInfo.intersects(otherInfo, false);
        
        if (isIntersecting) {
          // Critical log for actual collision
          console.log(`[CollisionSystem] COLLISION: Bullet ${bullet.id} hit ${other.id}`);
          console.log(`[CollisionSystem] Bullet pos=(${bulletTransform.pos.x.toFixed(1)},${bulletTransform.pos.y.toFixed(1)},${bulletTransform.pos.z.toFixed(1)})`);
          console.log(`[CollisionSystem] Other pos=(${otherTransform.pos.x.toFixed(1)},${otherTransform.pos.y.toFixed(1)},${otherTransform.pos.z.toFixed(1)})`);

          // Determine hit position (approximate center of bullet for now)
          const hitPosition = bulletTransform.pos.clone();

          // Determine particle color and count based on target type
          let particleColor: Color4;
          let particleCount: number;

          if (otherHealth) { // It's an enemy or player (has health)
            particleColor = new Color4(1.0, 0.2, 0.1, 1.0); // Reddish/Orange
            particleCount = 15;
          } else { // It's likely a static object (wall, obstacle)
            particleColor = new Color4(0.5, 0.5, 0.5, 1.0); // Greyish
            particleCount = 10;
          }

          // Apply damage if the other entity has health
          if (otherHealth) { 
            otherHealth.hp -= bulletData.damage; 
            console.log(`${other.id} health: ${otherHealth.hp}/${otherHealth.maxHp}`);
            if (otherHealth.hp <= 0) {
              console.log(`${other.id} died!`);
            }
          } 

          // Spawn particles
          this.particleSystem.spawnParticles(hitPosition, particleColor, particleCount, 0.4, 1.0, 4.0);

          this.bulletSystem.returnBullet(bullet);
          break; // Bullet hit something, stop checking for this bullet
        }
      }
    }
  }
} 