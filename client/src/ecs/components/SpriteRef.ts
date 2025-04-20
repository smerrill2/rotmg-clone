import { SpriteManager, Sprite } from "@babylonjs/core";

/**
 * Data associated with the SpriteRef component.
 */
export type SpriteRefData = {
  /** URL of the sprite sheet texture. */
  sheetUrl: string;
  /** Index of the cell within the sprite sheet. */
  cellIndex: number;
  /** Optional: Native size of a cell in pixels (if different from manager). */
  cellSize?: { width: number, height: number };
  /** Optional: Desired rendering size in world units. */
  renderSize?: { width: number, height: number };
  /** Flag indicating if the sprite should be rendered. */
  isVisible: boolean;
  /** Optional: Specific name for the sprite instance. 
   * Render system might manage this. */
  spriteName?: string;
  /** Optional: Reference to the BabylonJS SpriteManager instance. 
   *  Render system might manage this. */
  manager?: SpriteManager;
  /** Optional: Direct reference to the BabylonJS Sprite instance. 
   *  Render system might manage this. */
  spriteInstance?: Sprite;
};

/**
 * Component identifier for SpriteRef.
 */
export const SpriteRef = "spriteRef";
