import { Entity } from "../world"; // Adjusted path to world
// Remove unused imports
// import { Velocity } from "../components/Velocity";
// import { Player } from "../components/Player";

// CURSOR: Add mouse input later for aiming/shooting

/** System responsible ONLY for handling player input (WASDQE) and storing state. */
export class InputSystem {
  public keysPressed: { [key: string]: boolean } = {};
  // No queries needed
  // No update/onUpdate needed - state is updated via event listeners

  constructor() {
    console.log("[InputSystem] Adding event listeners...");
    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
    window.addEventListener("keyup", (e) => this.handleKeyUp(e));
  }

  private handleKeyDown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    console.log(`[InputSystem] KeyDown: ${key}`);
    this.keysPressed[key] = true;
  }

  private handleKeyUp(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    console.log(`[InputSystem] KeyUp: ${key}`);
    this.keysPressed[key] = false;
  }

  // Remove the onUpdate method entirely
} 