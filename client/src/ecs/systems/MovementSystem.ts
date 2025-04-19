// import { ISystem } from "miniplex"; // Remove this - Miniplex v2 doesn't export ISystem
import { Entity, world } from "../world";
import { Transform } from "../components/Transform";
import { Velocity } from "../components/Velocity";
import { Player } from "../components/Player"; // Import Player tag
import { InputSystem } from "./InputSystem"; // Import InputSystem
import { FreeCamera, Vector3, Matrix, Quaternion } from "@babylonjs/core"; // Import Babylon types

// Temporary vectors - Keep these
const _forward = new Vector3(); // Will store camera forward (projected)
const _right = new Vector3();   // Will store camera right (projected)
const _moveDirection = new Vector3();
const _cameraTargetPosition = new Vector3();
const _desiredCameraPosition = new Vector3();
const _rotationMatrix = new Matrix(); // For rotating the offset

// Define the INITIAL fixed isometric offset vector
// We will rotate this vector over time
let cameraIsoOffset = new Vector3(-15, 20, -15); 

// --- Remove World-Axis Vectors --- (No longer needed)
// const worldForward = ...

/** 
 * System responsible for calculating player movement velocity 
 * based on WASD input in an isometric view.
 */
export class MovementSystem {
  // Use Miniplex v2 query method: world.with()
  // Restore original query components
  // private playerQuery = world.archetype<Entity>(Player); // Old temporary debug
  private playerQuery = world.with(Player, Transform, Velocity);
  
  // Query for all moving entities using world.with()
  private allMovingQuery = world.with(Transform, Velocity);

  private inputSystem: InputSystem;
  private camera: FreeCamera;
  private logThrottle = 0; // Simple throttle for logs
  private readonly LOG_INTERVAL = 30; // Log every 30 frames
  private playerNotFoundLogged = false;

  constructor(inputSystem: InputSystem, camera: FreeCamera) {
    this.inputSystem = inputSystem;
    this.camera = camera;
  }

  update(dt: number) {
    const keys = this.inputSystem.keysPressed;
    const moveSpeed = 5.0; // Units per second, adjust as needed
    const rotationSpeed = 2.0; // Radians per second for camera rotation

    // --- Calculate Rotation Amount for Offset --- 
    let rotationAmount = 0;
    if (keys["q"]) {
      // Q should rotate left (negative angle for RotationY)
      rotationAmount = -rotationSpeed * dt; 
    }
    if (keys["e"]) {
      // E should rotate right (positive angle for RotationY)
      rotationAmount = rotationSpeed * dt; 
    }

    // Throttling setup
    this.logThrottle--;
    const shouldLog = this.logThrottle <= 0;



    // --- Calculate Camera-Relative Movement Vectors (Projected onto XZ plane) --- (Restore this)
    this.camera.getDirectionToRef(Vector3.Forward(), _forward);
    this.camera.getDirectionToRef(Vector3.Right(), _right);
    _forward.y = 0; 
    _right.y = 0;   
    _forward.normalize();
    _right.normalize();
    // Can optionally remove the _right vector log now if movement works
    // if (shouldLog) { console.log(`[MovementSystem] Projected & Normalized _right...`); }

    // --- Player Velocity Calculation (Using Camera-Relative Vectors) ---
    _moveDirection.set(0, 0, 0);
    let keyWasPressed = false; 
    // Use CAMERA-RELATIVE vectors
    if (keys["w"]) { 
        _moveDirection.addInPlace(_forward); // Use camera forward
        keyWasPressed = true; 
    }
    if (keys["s"]) { 
        _moveDirection.subtractInPlace(_forward); // Use camera forward
        keyWasPressed = true; 
    }
    if (keys["a"]) { 
        _moveDirection.subtractInPlace(_right); // Use camera right
        keyWasPressed = true;
    }
    if (keys["d"]) { 
        _moveDirection.addInPlace(_right); // Use camera right
        keyWasPressed = true;
    }

    const isMoving = _moveDirection.lengthSquared() > 0.001;

    // Conditional logging (remains useful)
    if (shouldLog && keyWasPressed) {
        console.log("[MovementSystem] Keys pressed:", JSON.stringify(keys));
        console.log("[MovementSystem] Using Camera Vectors - Calculated _moveDirection (before norm):", _moveDirection.x.toFixed(2), _moveDirection.y.toFixed(2), _moveDirection.z.toFixed(2));
        this.logThrottle = this.LOG_INTERVAL;
    }

    // Normalize and scale if moving
    if (isMoving) {
        _moveDirection.normalize();
        _moveDirection.scaleInPlace(moveSpeed);
    }

    if (shouldLog && isMoving) {
        console.log("[MovementSystem] Using Camera Vectors - Final _moveDirection (after norm/scale):", _moveDirection.x.toFixed(2), _moveDirection.y.toFixed(2), _moveDirection.z.toFixed(2));
    }

    // Update velocity component for player entities
    let playerVelocityUpdated = false;
    for (const entity of this.playerQuery) {
        const velocity = entity[Velocity]; // Get the VelocityData component
        if (velocity) { // Check if component exists
          velocity.vel.x = _moveDirection.x; // Update the x component of the vel Vector3
          velocity.vel.z = _moveDirection.z; // Update the z component of the vel Vector3 (Y is up)
          if (shouldLog && isMoving && !playerVelocityUpdated) {
              console.log(`[MovementSystem] Updating player ${entity.id} velocity to: X=${velocity.vel.x.toFixed(2)}, Z=${velocity.vel.z.toFixed(2)}`);
              playerVelocityUpdated = true;
          }
        }
    }

    // --- Position Integration (Applies to ALL entities with Transform & Velocity) ---
    // Declare the temporary vector here
    const _scaledVelocity = new Vector3();
    
    for (const entity of this.allMovingQuery) {
      const transform = entity[Transform]!;
      const velocity = entity[Velocity]!;
      
      // --- REMOVE DEBUG LOG ---
      // if (entity.id === "enemy-test-1") { ... }
      // --- END REMOVE DEBUG LOG ---

      // Calculate position change: deltaPos = velocity * dt
      _scaledVelocity.copyFrom(velocity.vel).scaleInPlace(dt);
      
      // --- REMOVE DEBUG LOG ---
      // if (entity.id === "enemy-test-1") { ... }
      // --- END REMOVE DEBUG LOG ---

      // Apply update
      transform.pos.addInPlace(_scaledVelocity);
      
      // --- REMOVE DEBUG LOG ---
      // if (entity.id === "enemy-test-1") { ... }
      // --- END REMOVE DEBUG LOG ---
    }

    // --- Camera Following and ROTATION --- 
    const playerEntities = this.playerQuery;
    let playerCount = 0;
    for (const player of playerEntities) {
        playerCount++;
        const playerTransform = player[Transform]; 
        if (playerTransform && playerTransform.pos) { 

            // --- Rotate the Offset Vector --- 
            if (rotationAmount !== 0) {
                Matrix.RotationYToRef(rotationAmount, _rotationMatrix);
                // Rotate the current offset vector by the matrix
                Vector3.TransformCoordinatesToRef(cameraIsoOffset, _rotationMatrix, cameraIsoOffset); // Update offset in place
                 if (shouldLog) {
                     console.log(`[MovementSystem] Rotated cameraIsoOffset: X=${cameraIsoOffset.x.toFixed(2)}, Y=${cameraIsoOffset.y.toFixed(2)}, Z=${cameraIsoOffset.z.toFixed(2)}`);
                 }
            }

            // --- Update Camera Position using the (potentially rotated) offset ---
            _desiredCameraPosition.copyFrom(playerTransform.pos).addInPlace(cameraIsoOffset);
            this.camera.position.copyFrom(_desiredCameraPosition);
            
            // --- Update Camera Target --- 
            _cameraTargetPosition.copyFrom(playerTransform.pos);
            this.camera.setTarget(_cameraTargetPosition); // SetTarget will handle the final rotation

            this.playerNotFoundLogged = false; 
            break; 
        } else {
            // console.warn("MovementSystem: Player found, but Transform component or pos property is missing/undefined.");
        }
    }
    if (playerCount === 0 && !this.playerNotFoundLogged) {
        // console.warn("MovementSystem: Player entity not found by query (requires Player, Transform, Velocity components).");
        // this.playerNotFoundLogged = true; 
    }
  }
} 