import type { SpriteManager } from "@babylonjs/core/Sprites/spriteManager";
import type { Sprite } from "@babylonjs/core/Sprites/sprite";
import { Color4 } from "@babylonjs/core";

/**
 * Data associated with the SpriteRef component.
 */
export type SpriteRefData = {
  /** URL of the sprite sheet texture. */
  sheetUrl: string;
  /** Index of the cell within the sprite sheet. */
  cellIndex: number;
  /** Optional: Reference to the BabylonJS SpriteManager instance. 
   *  Render system might manage this. */
  manager?: SpriteManager | null;
  /** Optional: Specific name for the sprite instance. 
   * Render system might manage this. */
  spriteName?: string;
  /** Optional: Direct reference to the BabylonJS Sprite instance. 
   *  Render system might manage this. */
  spriteInstance?: Sprite | null;
  /** Flag indicating if the sprite should be rendered. */
  isVisible: boolean;
  /** Optional: Native size of a cell in pixels (if different from manager). */
  cellSize?: { width: number, height: number };
  /** Optional: Desired rendering size in world units. */
  renderSize?: { width: number, height: number };
  /** Optional: Tint color. */
  // tint?: Color4;
};

/**
 * Component identifier for SpriteRef.
 */
export const SpriteRef = "spriteRef";
