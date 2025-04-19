import { Scene } from "@babylonjs/core/scene";
import { SpriteManager } from "@babylonjs/core/Sprites/spriteManager";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { World } from "miniplex";
import { Entity, world } from "../world";
import { Bullet, type BulletData } from "../components/Bullet";
import { Transform, type TransformData } from "../components/Transform";
import { Velocity, type VelocityData } from "../components/Velocity";
import { SpriteRef, type SpriteRefData } from "../components/SpriteRef";
import { Collidable, type CollidableData } from "../components/Collidable";
import { BoundingBox } from "@babylonjs/core/Culling/boundingBox";
import { BoundingInfo } from "@babylonjs/core/Culling/boundingInfo";

const BULLET_POOL_SIZE = 256;
const BULLET_SPRITE_SHEET = "/sprites/bullet.png"; // Revert back to bullet.png
const BULLET_SPRITE_SIZE = 8; // Keep 10x10 size
const BULLET_CELL_INDEX = 0; // Keep cell index 0
const BULLET_SPEED = 25;
const BULLET_LIFESPAN = 2; // seconds
const BULLET_DAMAGE = 10;

/**
 * Manages the spawning, pooling, and lifespan of bullet entities.
 */
export class BulletSystem {
  private pool: Entity[] = [];
  private activeBullets = world.with(Bullet, Transform, Velocity);
  private scene: Scene;
  private spriteManager: SpriteManager;

  constructor(scene: Scene) {
    this.scene = scene;
    // CURSOR: Ensure RenderSprite system handles sprite creation from SpriteRef
    // We just need the manager here to potentially control visibility if needed,
    // though RenderSprite should handle hiding based on component removal.
    this.spriteManager = new SpriteManager(
      "bulletSpriteManager",
      BULLET_SPRITE_SHEET,
      BULLET_POOL_SIZE,
      { width: BULLET_SPRITE_SIZE, height: BULLET_SPRITE_SIZE },
      this.scene
    );

    // Pre-allocate bullet entities
    for (let i = 0; i < BULLET_POOL_SIZE; i++) {
      // Create base entity, initially inactive (no components except maybe ID)
      const bulletEntity = world.add({
        id: `bullet_${i}`, 
        // Add inactive sprite ref so RenderSystem can potentially find the sprite instance
        // The sprite instance itself should be initially hidden/disabled by RenderSystem
        // This requires RenderSystem to handle entities added *without* a transform
        spriteRef: { 
            spriteName: `bullet_sprite_${i}`,
            manager: this.spriteManager,
            sheetUrl: BULLET_SPRITE_SHEET,
            cellIndex: BULLET_CELL_INDEX,
            cellSize: { width: BULLET_SPRITE_SIZE, height: BULLET_SPRITE_SIZE },
            isVisible: false, // Initially not visible
            renderSize: { width: 0.5, height: 0.5 } // Set bullet render size
        }
      });
      this.pool.push(bulletEntity);
    }
  }

  /**
   * Retrieves a bullet from the pool and activates it.
   * @param firedBy The entity ID that fired the bullet.
   * @param position Initial position.
   * @param direction Normalized direction vector.
   */
  fireBullet(firedBy: number | string, position: Vector3, direction: Vector3) {
    if (this.pool.length === 0) {
      console.warn("Bullet pool empty!");
      return;
    }

    const bulletEntity = this.pool.pop()!;

    // Calculate initial velocity
    const velocity = direction.scale(BULLET_SPEED);
    // Add a small offset in the direction of fire to avoid immediate self-collision
    const spawnPosition = position.add(direction.scale(0.5)); 
    spawnPosition.y = 4.0; // TEMP: Force higher Y position

    // Activate bullet by adding components individually
    world.addComponent(bulletEntity, Bullet, { 
        damage: BULLET_DAMAGE, 
        lifespan: BULLET_LIFESPAN, 
        firedBy 
    });
    world.addComponent(bulletEntity, Transform, { 
        pos: spawnPosition.clone(), 
    }); 
    world.addComponent(bulletEntity, Velocity, { vel: velocity });
    world.addComponent(bulletEntity, Collidable, {
      // Create BoundingInfo using manual BoundingBox min/max
      boundingInfo: new BoundingInfo(
        spawnPosition.subtract(new Vector3(0.5, 0.5, 0.5)),
        spawnPosition.add(new Vector3(0.5, 0.5, 0.5))
      )
    });
    
    // Update the SpriteRef component using addComponent to merge
    // NOTE: This update might not be reflected immediately in the same frame for other systems.
    world.addComponent(bulletEntity, SpriteRef, { 
        ...bulletEntity[SpriteRef], 
        sheetUrl: BULLET_SPRITE_SHEET, 
        cellIndex: BULLET_CELL_INDEX, 
        isVisible: true,
        cellSize: { width: BULLET_SPRITE_SIZE, height: BULLET_SPRITE_SIZE },
        renderSize: { width: 0.5, height: 0.5 } // Set bullet render size
    });
    console.log(`[BulletSystem] fireBullet setting isVisible=true for ${bulletEntity.id}`);

    // HACK: Directly mutate isVisible for immediate effect due to timing issues
    const spriteRefData = bulletEntity[SpriteRef];
    if (spriteRefData) { 
      // Ensure renderSize is set if not present during update (belt-and-suspenders)
      if (!spriteRefData.renderSize) {
          spriteRefData.renderSize = { width: 0.5, height: 0.5 };
      }
      spriteRefData.isVisible = true; // Directly mutate for immediate effect
    } else {
        console.warn(`[BulletSystem] fireBullet: SpriteRef component not found immediately after addComponent for ${bulletEntity.id}?`);
    }
  }

  /**
   * Returns a bullet entity to the pool, making it inactive.
   * @param entity The bullet entity to return.
   */
  returnBullet(entity: Entity) {
    // Remove active components
    world.removeComponent(entity, "bullet");
    world.removeComponent(entity, "transform");
    world.removeComponent(entity, "velocity");
    world.removeComponent(entity, "collidable");

    // Update SpriteRef visibility - Check existence via optional chaining
    const spriteRefDataToHide = entity[SpriteRef]; 
    if (spriteRefDataToHide) { // Check if component exists
      // Re-add component to update
      world.addComponent(entity, SpriteRef, { 
          ...spriteRefDataToHide, // Spread existing data first
          sheetUrl: spriteRefDataToHide.sheetUrl, // Explicitly keep sheetUrl
          cellIndex: spriteRefDataToHide.cellIndex, // Explicitly keep cellIndex
          isVisible: false,
          cellSize: { width: BULLET_SPRITE_SIZE, height: BULLET_SPRITE_SIZE },
          renderSize: { width: 0.5, height: 0.5 } // Set bullet render size
      });
      console.log(`[BulletSystem] returnBullet setting isVisible=false for ${entity.id}`);
    }

    // Add back to pool
    this.pool.push(entity);
  }

  update(dt: number) {
    for (const entity of world.with(Bullet, Transform, Velocity)) {
      // Check if bullet component data exists
      const bulletData = entity[Bullet];
      if (!bulletData) continue; 

      // Update lifespan
      bulletData.lifespan -= dt;

      // Update BoundingInfo position
      const transformData = entity[Transform];
      const collidableData = entity[Collidable];
      if (collidableData && transformData) {
        const halfSize = 0.5; // Half the size used in fireBullet
        const min = transformData.pos.subtract(new Vector3(halfSize, halfSize, halfSize));
        const max = transformData.pos.add(new Vector3(halfSize, halfSize, halfSize));
        // Use BoundingInfo's reConstruct method
        collidableData.boundingInfo.reConstruct(min, max);
      }

      // --- Log lifespan before check ---
      console.log(`[BulletSystem] Update check: ${entity.id} lifespan=${bulletData.lifespan.toFixed(2)}`);
      // --- End log ---

      // Return bullet to pool if lifespan expired
      if (bulletData.lifespan <= 0) {
        console.log(`[BulletSystem] Lifespan expired for ${entity.id}, returning to pool.`); // Log return reason
        this.returnBullet(entity);
      }
    }
  }
} 