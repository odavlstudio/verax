/**
 * Type augmentation for Node.js fs module
 * Provides more precise return types for readFileSync with encoding
 */

declare module 'fs' {
  import { PathLike } from 'fs';
  
  /**
   * Augment readFileSync to return string when encoding is specified
   */
  export function readFileSync(
    path: PathLike | number,
    options?: { encoding?: null; flag?: string } | null
  ): Buffer;
  
  export function readFileSync(
    path: PathLike | number,
    options: { encoding: BufferEncoding; flag?: string } | BufferEncoding
  ): string;
}

export {};
