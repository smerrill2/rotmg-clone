import './style.css'
import { Engine, Scene, FreeCamera, Vector3, HemisphericLight, Color4, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';
import { world } from './ecs/world';
import { createRenderSpriteSystem } from './ecs/systems/RenderSprite';
import { InputSystem } from './ecs/systems/InputSystem';
import { MovementSystem } from './ecs/systems/MovementSystem';
import { BulletSystem } from './ecs/systems/BulletSystem';
import { CollisionSystem } from './ecs/systems/CollisionSystem';
// Import component *identifiers* (strings) and *data types*
import { Transform, type TransformData } from './ecs/components/Transform';
import { Velocity, type VelocityData } from './ecs/components/Velocity';
import { SpriteRef, type SpriteRefData } from './ecs/components/SpriteRef';
import { Player } from './ecs/components/Player';
import { Health, type HealthData } from './ecs/components/Health';
import { Collidable, type CollidableData } from './ecs/components/Collidable';
import { BoundingBox } from '@babylonjs/core/Culling/boundingBox';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo';
import "@babylonjs/core/Debug/debugLayer"; // Import the debug layer
import "@babylonjs/inspector";           // Import the inspector
import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'; // <-- ADD Import

// Player starting position (used for camera setup)
const playerStartX = 0;
const playerStartY = 0.5; // Slightly above ground
const playerStartZ = 0;
const playerInitialPos = new Vector3(playerStartX, playerStartY, playerStartZ);
// Define the isometric offset for the camera relative to the player
const cameraIsoOffset = new Vector3(-15, 20, -15); // Change X offset to view from a diagonal angle

// Get the canvas element
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

// Create the Babylon.js engine
const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
});

// Create the scene
const scene = new Scene(engine);
scene.clearColor = new Color4(0.2, 0.2, 0.3, 1.0); // Slightly lighter background

// --- Create Isometric Orthographic Camera --- 
const camera = new FreeCamera(
  "isoCam", // Renamed for clarity
  // Position the camera initially using the player's start + isometric offset
  playerInitialPos.add(cameraIsoOffset), 
  scene
);
camera.mode = FreeCamera.ORTHOGRAPHIC_CAMERA;

// Point the camera AT THE PLAYER'S START POSITION
// Let setTarget handle the rotation entirely
// camera.rotation.x = Math.PI / 2; // Remove manual rotation
// camera.rotation.y = 0;
// camera.rotation.z = 0;
camera.setTarget(playerInitialPos); // Target the player's starting point

// Define the orthographic view frustum dimensions
// Keep previous values for now, may need tuning for isometric view
const zoomLevel = 1; // Adjust this value to zoom in/out
const aspectRatio = engine.getRenderWidth() / engine.getRenderHeight();
camera.orthoLeft   = -10 * aspectRatio * zoomLevel;
camera.orthoRight  =  10 * aspectRatio * zoomLevel;
camera.orthoTop    =  10 * zoomLevel;  // Use a consistent size vertically
camera.orthoBottom = -10 * zoomLevel;

// No camera controls needed for a fixed top-down view
// camera.attachControl(canvas, true); // Removed

// --- Create a light ---
const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene); // Light from above

// --- Create Static Ground Plane ---
const groundSize = 50; // Make the ground reasonably large
const ground = MeshBuilder.CreateGround("ground", { width: groundSize, height: groundSize }, scene);
// Optional: Position ground slightly below player start y if needed, but 0 should be fine
// ground.position.y = -0.1;

// Create a simple material with a wireframe
const groundMaterial = new StandardMaterial("groundMat", scene);
groundMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5); // Grey color
groundMaterial.wireframe = true;
ground.material = groundMaterial;

// --- Add Static Reference Cubes ---
const boxMaterialRed = new StandardMaterial("boxMatRed", scene);
boxMaterialRed.diffuseColor = new Color3(1, 0, 0); // Red

// --- Temporarily comment out red box ---
// const box1 = MeshBuilder.CreateBox("refBox1", {size: boxSize}, scene);
// box1.position = new Vector3(5, boxY, 5);
// box1.material = boxMaterialRed;
// --- End comment out ---

const boxMaterialBlue = new StandardMaterial("boxMatBlue", scene);
boxMaterialBlue.diffuseColor = new Color3(0, 0, 1); // Blue

const boxMaterialGreen = new StandardMaterial("boxMatGreen", scene);
boxMaterialGreen.diffuseColor = new Color3(0, 1, 0); // Green

const boxSize = 1;
const boxY = boxSize / 2; // Place bottom on the ground

const box2 = MeshBuilder.CreateBox("refBox2", {size: boxSize}, scene);
box2.position = new Vector3(-5, boxY, 8);
box2.material = boxMaterialBlue;

const box3 = MeshBuilder.CreateBox("refBox3", {size: boxSize}, scene);
box3.position = new Vector3(0, boxY, -6);
box3.material = boxMaterialGreen;

// Handle window resize
window.addEventListener('resize', () => {
  engine.resize();
});

// --- Create System Instances ---
const inputSystem = new InputSystem();
const movementSystem = new MovementSystem(inputSystem, camera);
const renderSpriteSystem = createRenderSpriteSystem(scene);
const bulletSystem = new BulletSystem(scene);
const collisionSystem = new CollisionSystem(bulletSystem);

// --- Firing Logic (Click-based) --- MODIFIED
let canFire = true;
const fireCooldown = 0.2; // seconds

// Remove the spacebar listener
// window.addEventListener("keydown", (e) => { ... });

// Add a click listener (PointerDown event)
scene.onPointerObservable.add((pointerInfo) => {
    // Check if it's a left-click (button index 0) and the fire cooldown is ready
    if (pointerInfo.type === PointerEventTypes.POINTERDOWN && 
        pointerInfo.event.button === 0 && 
        canFire) {
        
        const player = world.with(Player, Transform).first; // Query using identifiers
        if (!player) return; // No player found

        // Use scene.pick to find where the user clicked in the 3D world
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);

        if (pickResult?.hit && pickResult.pickedPoint) {
            // Calculate direction from player to the clicked point
            const fireDirection = pickResult.pickedPoint.subtract(player[Transform].pos);
            
            // Project direction onto the XZ plane (ignore vertical difference)
            fireDirection.y = 0;
            fireDirection.normalize(); // Make it a unit vector

            // Check if direction is valid (avoid firing if click is too close or directly on player)
            if (fireDirection.lengthSquared() > 0.01) { 
                bulletSystem.fireBullet(player.id!, player[Transform].pos, fireDirection);
                
                // Start cooldown
                canFire = false;
                setTimeout(() => { canFire = true; }, fireCooldown * 1000);
            }
        }
    }
});
// --- End Firing Logic ---

// Main render loop
engine.runRenderLoop(() => {
  const dt = engine.getDeltaTime() / 1000;
  // Log dt to check for weird values
  // console.log(`[MainLoop] dt: ${dt}`);

  // Manually update systems in order
  movementSystem.update(dt);
  bulletSystem.update(dt);
  renderSpriteSystem.update(dt);
  collisionSystem.update(dt);

  scene.render();
});

// Initialize ECS components or entities if needed - MOVED TO AFTER SYSTEM CREATION
// ... initial world population ...

// --- Debugging --- 
scene.debugLayer.show({
  embedMode: true, // Embed the inspector in the page
});

// --- ECS Systems --- 
// System instances created above
// world.addSystem(inputSystem); - REMOVED
// world.addSystem(new MovementSystem(inputSystem, camera)); - REMOVED
// world.addSystem(createRenderSpriteSystem(scene)); - REMOVED

// --- Initial World Population (Test) ---
// CURSOR: Remove this test entity later
world.add({
  id: "player-test",
  [Player]: true,
  [Transform]: <TransformData>{
    pos: playerInitialPos.clone() // Use the defined starting position
  },
  [Velocity]: <VelocityData>{ vel: new Vector3(0, 0, 0) }, // Use Velocity identifier
  [SpriteRef]: <SpriteRefData>{
    sheetUrl: "/sprites/player.png",
    cellIndex: 0,
    cellSize: { width: 64, height: 64 },
    isVisible: true,
    renderSize: { width: 1.5, height: 1.5 }
  },
  // --- Use Component Identifiers as Keys ---
  [Health]: <HealthData>{ hp: 100, maxHp: 100 }, // Use Health identifier
  [Collidable]: <CollidableData>{ // Use Collidable identifier
    // Create BoundingInfo using manual BoundingBox min/max
    boundingInfo: new BoundingInfo(
      playerInitialPos.subtract(new Vector3(0.5, 0.5, 0.5)),
      playerInitialPos.add(new Vector3(0.5, 0.5, 0.5))
    )
  }
  // --- End ADDED Player Components ---
});

// --- Add a test enemy ---
const enemyInitialPos = new Vector3(5, 0.51, 5);
world.add({
  id: "enemy-test-1",
  // No 'Player' component
  [Transform]: <TransformData>{ pos: enemyInitialPos.clone() },
  [Velocity]: <VelocityData>{ vel: new Vector3(0, 0, 0) },
  [SpriteRef]: <SpriteRefData>{
    sheetUrl: "/sprites/enemy.png", // Revert back to enemy sheet
    cellIndex: 0,
    cellSize: { width: 64, height: 64 },
    isVisible: true,
    renderSize: { width: 1.5, height: 1.5 }
  },
  [Health]: <HealthData>{ hp: 50, maxHp: 50 }, // Use Health identifier
  [Collidable]: <CollidableData>{ // Use Collidable identifier
    // Create BoundingInfo using manual BoundingBox min/max
    boundingInfo: new BoundingInfo(
      enemyInitialPos.subtract(new Vector3(0.5, 0.5, 0.5)),
      enemyInitialPos.add(new Vector3(0.5, 0.5, 0.5))
    )
  }
});
// --- End Add test enemy ---

// --- Add ECS entities for static boxes ---
world.add({
  id: "refBox2-entity", // Unique ID for ECS
  [Transform]: { pos: box2.position }, // Link to mesh position
  [Collidable]: { boundingInfo: box2.getBoundingInfo() }
});

world.add({
  id: "refBox3-entity",
  [Transform]: { pos: box3.position },
  [Collidable]: { boundingInfo: box3.getBoundingInfo() }
});
// --- End Add static boxes ---
