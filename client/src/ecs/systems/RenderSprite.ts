import { Scene, SpriteManager, Sprite, Texture, Vector3, AbstractMesh } from "@babylonjs/core";
import { world, Entity } from "../world"; // Use Entity from world
import { Transform, type TransformData } from "../components/Transform";
import { SpriteRef, type SpriteRefData } from "../components/SpriteRef";
import { Velocity, type VelocityData } from "../components/Velocity"; // Import Velocity

// Define a more specific entity type for this system
// Needs spriteInstance added to the component data type ideally,
// but for now, we'll cast or manage it externally.
// We'll assume SpriteRefData might hold the instance after creation.
interface SpriteRefDataWithInstance extends SpriteRefData {
    spriteInstance?: Sprite;
}

type RenderableEntity = Entity & {
  // Use component constants as keys
  [Transform]: TransformData;
  [SpriteRef]: SpriteRefData; // Use standard type
  [Velocity]?: VelocityData; // Add optional Velocity
};

// Cache for SpriteManagers, one per sheet URL
const spriteManagers = new Map<string, SpriteManager>();

// Use cellSize from SpriteRefData if provided, otherwise default
function getSpriteManager(scene: Scene, url: string, cellSize: { width: number, height: number } | undefined): SpriteManager | undefined {
  // Use a default if none is provided in the call
  const effectiveCellSize = cellSize ?? { width: 64, height: 64 }; 
  // Use a composite key for the cache if sizes can vary per URL
  const cacheKey = `${url}_${effectiveCellSize.width}x${effectiveCellSize.height}`;

  console.log(`[RenderSprite] getSpriteManager called for URL: ${url}, CellSize: ${effectiveCellSize.width}x${effectiveCellSize.height}`);
  
  if (!spriteManagers.has(cacheKey)) { // Use cacheKey
    console.log(`[RenderSprite] Creating new SpriteManager for: ${cacheKey}`);
    try {
      const manager = new SpriteManager(
        `sm_${cacheKey}`, // Use cacheKey in name for uniqueness
        url,        
        2000,       
        effectiveCellSize,   // Use effective cell size
        scene,
        undefined,  
        Texture.NEAREST_SAMPLINGMODE 
      );

      // --- Explicit Alpha Blending --- 
      manager.texture.hasAlpha = true; // Ensure alpha is recognized
      manager.isPickable = false; // Sprites usually don't need picking
      
      // Ensure billboarding is enabled for all sprites in this manager
      manager.fogEnabled = false; // Disable fog for better visibility
      // --- End Alpha Blending ---

      spriteManagers.set(cacheKey, manager); // Use cacheKey
      console.log(`[RenderSprite] SpriteManager created and cached for: ${cacheKey}`);
      return manager; 
    } catch (error) {
      console.error(`[RenderSprite] Error creating SpriteManager instance for ${cacheKey}:`, error);
      return undefined; // Return undefined on error
    }
  }
  // Return from cache if it already exists
  return spriteManagers.get(cacheKey)!; 
}

export function createRenderSpriteSystem(scene: Scene) {
  console.log("[RenderSprite] System initializing...");

  // === Handle Added Entities ===
  world.onEntityAdded.subscribe((entity) => {
    if (entity[Transform] !== undefined && entity[SpriteRef] !== undefined) { 
        console.log(`[RenderSprite] ADDED detected: ${entity.id}`);
        const entityRenderable = entity as RenderableEntity;
        const spriteRefData = entityRenderable[SpriteRef]; 
        const transformData = entityRenderable[Transform];
        
        if (spriteRefData.spriteInstance) {
             console.warn(`[RenderSprite] Entity ${entity.id} added but already has spriteInstance?`);
             return; // Skip if sprite already exists
        }

        // Pass cellSize from component data to getSpriteManager
        const manager = getSpriteManager(scene, spriteRefData.sheetUrl, spriteRefData.cellSize);
        if (!manager) {
           console.error(`[RenderSprite] Failed to get SpriteManager for ${spriteRefData.sheetUrl} (entity: ${entity.id}). Sprite cannot be created.`);
           return; 
        }

        try {
          const sprite = new Sprite(`sprite_${entity.id}`, manager);
          spriteRefData.spriteInstance = sprite; // Store instance ON the component data
          
          // Set initial size based on component data or default to 1x1
          const renderWidth = spriteRefData.renderSize?.width ?? 1.0;
          const renderHeight = spriteRefData.renderSize?.height ?? 1.0;
          sprite.width = renderWidth;
          sprite.height = renderHeight;

          sprite.position.copyFrom(transformData.pos);
          sprite.cellIndex = spriteRefData.cellIndex;
          sprite.isVisible = spriteRefData.isVisible; 
          
          console.log(`[RenderSprite] Sprite instance created: ID=${entity.id}, Name=${sprite.name}, Visible=${sprite.isVisible}`);
        } catch (creationError) {
           console.error(`[RenderSprite] Error creating Sprite instance for added entity ${entity.id}:`, creationError);
           spriteRefData.spriteInstance = undefined; // Ensure no partial ref
        }
    }
  });

  // === Handle Removed Entities ===
  world.onEntityRemoved.subscribe((entity) => {
    // Check if the entity *was* renderable before removal
    // We need to check the component data which might still be on the entity object briefly
    // or rely on the spriteInstance being present if it was successfully created.
    const spriteRefData = entity[SpriteRef] as SpriteRefDataWithInstance | undefined;

    if (spriteRefData?.spriteInstance) { // Check if it had an instance
        console.log(`[RenderSprite] REMOVED detected: ${entity.id}, disposing sprite.`);
        spriteRefData.spriteInstance.dispose();
        spriteRefData.spriteInstance = undefined; // Clear reference
        console.log(`[RenderSprite] Sprite instance disposed for removed ${entity.id}`);
    } else {
        // It might have been removed before a sprite was created, or didn't match
        // console.log(`[RenderSprite] Removed entity ${entity.id} had no spriteInstance to dispose.`);
    }
  });

  // Define the query for the update loop - INCLUDE Velocity
  const query = world.with(Transform, SpriteRef);

  return {
    // === Update Loop ===
    update: (_dt: number) => { 
      // Update existing sprite instances
      for (const entity of query) {
        const entityRenderable = entity as RenderableEntity;
        const transformData = entityRenderable[Transform];
        const spriteRefData = entityRenderable[SpriteRef];
        const velocityData = entityRenderable[Velocity]; // Get velocity data
        let sprite = spriteRefData.spriteInstance; 

        // Determine desired render size or default to 1x1
        const renderWidth = spriteRefData.renderSize?.width ?? 1.0;
        const renderHeight = spriteRefData.renderSize?.height ?? 1.0;

        // Create sprite instance if missing and should be visible
        if (!sprite && spriteRefData.isVisible) {
          const manager = getSpriteManager(scene, spriteRefData.sheetUrl, spriteRefData.cellSize);
          if (!manager) {
             console.error(`[RenderSprite] Failed to get SpriteManager for ${spriteRefData.sheetUrl} (entity: ${entity.id}). Sprite cannot be created.`);
             return; 
          }

          try {
            sprite = new Sprite(`sprite_${entity.id}`, manager);
            spriteRefData.spriteInstance = sprite; // Store instance ON the component data
            
            // Set initial size 
            sprite.width = renderWidth;
            sprite.height = renderHeight;

            sprite.position.copyFrom(transformData.pos);
            sprite.cellIndex = spriteRefData.cellIndex;
            sprite.isVisible = spriteRefData.isVisible;
            
            console.log(`[RenderSprite] Sprite instance created: ID=${entity.id}, Name=${sprite.name}, Visible=${sprite.isVisible}`);
          } catch (creationError) {
             console.error(`[RenderSprite] Error creating Sprite instance for added entity ${entity.id}:`, creationError);
             spriteRefData.spriteInstance = undefined; // Ensure no partial ref
          }
        }

        // Update sprite properties if the instance exists
        if (sprite) {
          sprite.position.copyFrom(transformData.pos);
          sprite.cellIndex = spriteRefData.cellIndex;
          sprite.isVisible = spriteRefData.isVisible;
          
          // Update size 
          sprite.width = renderWidth;
          sprite.height = renderHeight; 

          // Only update angle for bullets with velocity (they should still rotate while billboarding)
          if (velocityData && entity.id?.toString().startsWith("bullet_")) {
              const vel = velocityData.vel;
              // Check if moving significantly in XZ plane
              if (Math.abs(vel.x) > 0.01 || Math.abs(vel.z) > 0.01) { 
                  // Calculate angle from velocity vector (atan2 gives angle from +X axis)
                  let angle = Math.atan2(vel.z, vel.x);
                  // Adjust angle because sprite image points up (+Z) by default
                  angle -= Math.PI / 2; 
                  sprite.angle = angle;
              }
          }

          // --- Final Bullet Render State Log ---
          if (entity.id?.toString().startsWith("bullet_")) {
            console.log(`[RenderSprite] FINAL RENDER STATE: Bullet=${entity.id}, isVisible=${sprite.isVisible}, Pos=(${sprite.position.x.toFixed(1)},${sprite.position.y.toFixed(1)},${sprite.position.z.toFixed(1)})`);
          }
          // --- End Final Bullet Render State Log ---
        }
      }
    }
  };
}